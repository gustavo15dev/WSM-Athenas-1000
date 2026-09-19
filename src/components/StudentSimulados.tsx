import React, { useState, useEffect, useRef } from 'react';
import { 
  ClipboardList, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  BookOpen, 
  Eye, 
  ArrowLeft, 
  Check, 
  Sparkles, 
  Trophy,
  ArrowRightLeft,
  EyeOff,
  Lock,
  ShieldAlert,
  Monitor
} from 'lucide-react';
import { supabase } from '../supabase';
import { MockExam, MockExamQuestion, MockSubmission } from '../types';
import { logSystemAction } from '../utils/auditLogger';
import { parseExamSettings } from '../utils/examSettings';
import { matchesStudentTarget } from '../utils/targetMatcher';

interface StudentSimuladosProps {
  email: string;
  studentName: string;
  studentClass: string;
  isRoomContext?: boolean;
  onExamActiveChange?: (active: boolean) => void;
  onStudyForExam?: (theme: string, content: string) => void;
}

const activeAiProcessingSet = new Set<string>();

// Helper to silently request AI correction with 5s retry loop
async function processAiWrittenGradesWithRetry(
  submissionId: string,
  exam: MockExam,
  answers: Record<string, string | number>,
  initialManualGrades: Record<string, any> = {},
  onComplete?: (updatedGrades: Record<string, any>, newScore: number, newCorrectCount: number) => void
) {
  if (!submissionId || !exam || !exam.questions) return;
  if (activeAiProcessingSet.has(submissionId)) return;

  const aiQuestions = exam.questions.filter(q => 
    q.type === 'written' && 
    q.correctionType === 'ai' && 
    q.expectedAnswer && 
    q.expectedAnswer.trim().length > 0 &&
    !initialManualGrades[q.id]
  );

  if (aiQuestions.length === 0) return;

  activeAiProcessingSet.add(submissionId);
  const currentGrades = { ...initialManualGrades };

  try {
    for (const q of aiQuestions) {
      const studentAnswer = answers[q.id] ? String(answers[q.id]) : "";
      const qPts = q.points !== undefined && q.points > 0 ? q.points : 1.0;

      let success = false;
      let attemptCount = 0;

      while (!success && attemptCount < 3) {
        attemptCount += 1;
        try {
          const response = await fetch('/api/gemini/grade-written', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionText: q.text,
              studentAnswer: studentAnswer,
              expectedAnswer: q.expectedAnswer,
              points: qPts
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data && data.status) {
              currentGrades[q.id] = {
                status: data.status,
                pointsAwarded: data.pointsAwarded !== undefined ? data.pointsAwarded : (data.status === 'correct' ? qPts : data.status === 'half' ? qPts / 2 : 0),
                comment: data.comment || '',
                gradedBy: 'ai'
              };
              success = true;
            }
          }
        } catch (err) {
          console.warn(`Tentativa #${attemptCount} de correção por IA falhou:`, err);
        }

        if (!success && attemptCount < 3) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // Fallback if AI server response was unattainable after 3 attempts
      if (!success) {
        const sLower = String(studentAnswer).toLowerCase().trim();
        const eLower = String(q.expectedAnswer).toLowerCase().trim();
        if (!studentAnswer || sLower.length < 3) {
          currentGrades[q.id] = {
            status: 'wrong',
            pointsAwarded: 0,
            comment: 'Questão em branco ou resposta insuficiente.',
            gradedBy: 'ai_fallback'
          };
        } else {
          const expectedWords = eLower.split(/\W+/).filter(w => w.length > 3);
          const matchedWords = expectedWords.filter(w => sLower.includes(w));
          const ratio = expectedWords.length > 0 ? matchedWords.length / expectedWords.length : 0;
          if (ratio >= 0.4 || sLower.includes(eLower)) {
            currentGrades[q.id] = {
              status: 'correct',
              pointsAwarded: qPts,
              comment: 'Resposta atende aos critérios essenciais do gabarito oficial.',
              gradedBy: 'ai_fallback'
            };
          } else if (ratio >= 0.15 || sLower.length > 20) {
            currentGrades[q.id] = {
              status: 'half',
              pointsAwarded: qPts / 2,
              comment: 'Resposta parcial em relação ao gabarito da professora.',
              gradedBy: 'ai_fallback'
            };
          } else {
            currentGrades[q.id] = {
              status: 'wrong',
              pointsAwarded: 0,
              comment: 'Resposta incorreta ou divergente do gabarito.',
              gradedBy: 'ai_fallback'
            };
          }
        }
      }
    }

    // Calculate new score and correct count
    let totalScore = 0;
    let correctCount = 0;

    exam.questions.forEach(q => {
      const qPts = q.points !== undefined && q.points > 0 ? q.points : 1.0;
      const ans = answers[q.id];
      const hasAns = ans !== undefined && ans !== null && ans !== '' && ans !== 'undefined';

      if (q.type === 'multiple') {
        let expectedCorrect = q.correctOption;
        // If q is from a shuffled exam object that has originalIndices, resolve back to original index
        if (q.originalIndices && q.correctOption !== undefined) {
          expectedCorrect = q.originalIndices[q.correctOption];
        }
        if (hasAns && Number(ans) === expectedCorrect) {
          totalScore += qPts;
          correctCount += 1;
        }
      } else if (q.type === 'written') {
        const g = currentGrades[q.id];
        if (g) {
          totalScore += (g.pointsAwarded || 0);
          if (g.status === 'correct') correctCount += 1;
          else if (g.status === 'half') correctCount += 0.5;
        }
      }
    });

    totalScore = Math.round(totalScore * 10) / 10;
    correctCount = Math.round(correctCount * 10) / 10;

    try {
      const { data: currentSub } = await supabase
        .from('wsm_mock_submissions')
        .select('telemetry')
        .eq('id', submissionId)
        .single();
      
      let tel = currentSub?.telemetry;
      if (typeof tel === 'string') {
        try { tel = JSON.parse(tel); } catch { tel = {}; }
      }
      tel = { ...(tel && typeof tel === 'object' ? tel : {}), manual_grades: currentGrades };

      await supabase
        .from('wsm_mock_submissions')
        .update({
          telemetry: tel,
          score: totalScore,
          correct_count: correctCount
        })
        .eq('id', submissionId);
    } catch (dbErr) {
      console.error("Erro ao atualizar nota da IA no banco:", dbErr);
    }

    if (onComplete) {
      onComplete(currentGrades, totalScore, correctCount);
    }
  } finally {
    activeAiProcessingSet.delete(submissionId);
  }
}

export default function StudentSimulados({ 
  email, 
  studentName, 
  studentClass,
  isRoomContext = false,
  onExamActiveChange,
  onStudyForExam
}: StudentSimuladosProps) {
  // Simulados states
  const [availableExams, setAvailableExams] = useState<MockExam[]>([]);
  const [mySubmissions, setMySubmissions] = useState<MockSubmission[]>([]);
  const [simuladosSubTab, setSimuladosSubTab] = useState<'pendentes' | 'realizados'>('pendentes');

  // Simulation states
  const [activeExam, setActiveExam] = useState<MockExam | null>(null);

  // Notify parent dashboard of exam activity state
  useEffect(() => {
    if (onExamActiveChange) {
      onExamActiveChange(!!activeExam);
    }
  }, [activeExam, onExamActiveChange]);
  const [reviewExam, setReviewExam] = useState<MockExam | null>(null);
  const [reviewSubmission, setReviewSubmission] = useState<MockSubmission | null>(null);

  // Form taking state: questionId -> optionIndex or string
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [examProgressIndex, setExamProgressIndex] = useState(0);

  // Telemetry state
  const [examStartTime, setExamStartTime] = useState<number>(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [telemetry, setTelemetry] = useState<Required<MockSubmission>['telemetry']>({
    totalTimeSeconds: 0,
    questionTimes: {},
    optionChanges: {},
    tabSwitches: 0,
    firstInteractionTime: ''
  });

  // Message banners
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Cheating Prevention, Fullscreen and Timer states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConfirmStart, setShowConfirmStart] = useState<MockExam | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(-1);
  const [showTimer, setShowTimer] = useState<boolean>(true);
  const [currentSubmissionId, setCurrentSubmissionId] = useState<string | null>(null);
  const [timeoutModalShown, setTimeoutModalShown] = useState<boolean>(false);

  // Refs to avoid stale closures in event listeners
  const originalExamRef = useRef<MockExam | null>(null);
  const telemetryRef = useRef(telemetry);
  const currentSubmissionIdRef = useRef(currentSubmissionId);
  const examStartTimeRef = useRef(examStartTime);
  const questionStartTimeRef = useRef(questionStartTime);
  const studentAnswersRef = useRef(studentAnswers);
  const examProgressIndexRef = useRef(examProgressIndex);

  useEffect(() => { telemetryRef.current = telemetry; }, [telemetry]);
  useEffect(() => { currentSubmissionIdRef.current = currentSubmissionId; }, [currentSubmissionId]);
  useEffect(() => { examStartTimeRef.current = examStartTime; }, [examStartTime]);
  useEffect(() => { questionStartTimeRef.current = questionStartTime; }, [questionStartTime]);
  useEffect(() => { studentAnswersRef.current = studentAnswers; }, [studentAnswers]);
  useEffect(() => { examProgressIndexRef.current = examProgressIndex; }, [examProgressIndex]);

  // Real-time progress and telemetry synchronization helper
  const mapShuffledToOriginal = (rawAnswers: Record<string, string | number>) => {
    if (!activeExam || !activeExam.questions) return rawAnswers;
    const mapped: Record<string, string | number> = {};
    activeExam.questions.forEach(q => {
      const studentAns = rawAnswers[q.id];
      const hasAns = studentAns !== undefined && studentAns !== null && studentAns !== '' && studentAns !== 'undefined';
      if (hasAns) {
        if (q.type === 'multiple' && q.originalIndices) {
          const numAns = Number(studentAns);
          if (!isNaN(numAns) && typeof studentAns !== 'boolean') {
            const mappedIdx = q.originalIndices[numAns];
            mapped[q.id] = mappedIdx !== undefined ? mappedIdx : studentAns;
          } else {
            mapped[q.id] = studentAns;
          }
        } else {
          mapped[q.id] = studentAns;
        }
      }
    });
    return mapped;
  };

  const mapOriginalToShuffled = (rawAnswers: Record<string, string | number>, questionsList: MockExamQuestion[]) => {
    const restored: Record<string, string | number> = {};
    questionsList.forEach(q => {
      const origAns = rawAnswers[q.id];
      const hasAns = origAns !== undefined && origAns !== null && origAns !== '' && origAns !== 'undefined';
      if (hasAns) {
        if (q.type === 'multiple' && q.originalIndices) {
          const numAns = Number(origAns);
          if (!isNaN(numAns) && typeof origAns !== 'boolean') {
            const shuffledPos = q.originalIndices.indexOf(numAns);
            if (shuffledPos !== -1) {
              restored[q.id] = shuffledPos;
            }
          } else {
            restored[q.id] = origAns;
          }
        } else {
          restored[q.id] = origAns;
        }
      }
    });
    return restored;
  };

  const computeMasterExamScore = (
    originalQuestions: MockExamQuestion[],
    originalAnswers: Record<string, string | number>,
    manualGrades: Record<string, any> = {}
  ) => {
    if (!originalQuestions || originalQuestions.length === 0) {
      return { score: 0, correctCount: 0, totalQuestions: 0 };
    }
    let totalScore = 0;
    let correctCount = 0;

    originalQuestions.forEach(q => {
      const qPts = q.points !== undefined && q.points > 0 ? q.points : 1.0;
      const ans = originalAnswers[q.id];
      const hasAns = ans !== undefined && ans !== null && ans !== '' && ans !== 'undefined';

      if (q.type === 'multiple') {
        let expectedCorrect = q.correctOption;
        if (q.originalIndices && q.correctOption !== undefined) {
          expectedCorrect = q.originalIndices[q.correctOption];
        }
        if (hasAns && Number(ans) === expectedCorrect) {
          totalScore += qPts;
          correctCount += 1;
        }
      } else if (q.type === 'written') {
        const g = manualGrades[q.id];
        if (g) {
          totalScore += (g.pointsAwarded || 0);
          if (g.status === 'correct') correctCount += 1;
          else if (g.status === 'half') correctCount += 0.5;
        }
      }
    });

    totalScore = Math.round(totalScore * 10) / 10;
    correctCount = Math.round(correctCount * 10) / 10;

    return {
      score: totalScore,
      correctCount,
      totalQuestions: originalQuestions.length
    };
  };

  const getExamSubmissionStatus = (
    exam?: MockExam | null,
    submission?: MockSubmission | null
  ) => {
    if (!exam) {
      return {
        hasPendingWritten: false,
        isFullyGraded: true,
        isPurelyWritten: false,
        isPurelyObjective: true,
        isMixed: false,
        totalQuestions: 0,
        multipleCount: 0,
        writtenCount: 0,
        pendingWrittenCount: 0,
        gradedWrittenCount: 0,
        totalExamPoints: 10,
        objectivePoints: 0,
        objectiveEarned: 0,
        objectiveCorrectCount: 0,
        writtenPoints: 0,
        writtenEarned: 0,
        totalEarned: 0,
      };
    }

    const questions: MockExamQuestion[] = Array.isArray(exam.questions)
      ? exam.questions
      : typeof exam.questions === 'string'
      ? (() => {
          try {
            return JSON.parse(exam.questions);
          } catch {
            return [];
          }
        })()
      : [];

    const multipleQuestions = questions.filter(q => q.type === 'multiple');
    const writtenQuestions = questions.filter(q => q.type === 'written');

    const totalExamPoints = exam.total_points || questions.reduce((sum, q) => sum + (q.points !== undefined && q.points > 0 ? q.points : 1.0), 0) || 10;
    const objectivePoints = multipleQuestions.reduce((sum, q) => sum + (q.points !== undefined && q.points > 0 ? q.points : 1.0), 0);
    const writtenPoints = writtenQuestions.reduce((sum, q) => sum + (q.points !== undefined && q.points > 0 ? q.points : 1.0), 0);

    let manualGrades = submission?.manual_grades;
    if (!manualGrades || Object.keys(manualGrades).length === 0) {
      if (submission?.telemetry && typeof submission.telemetry === 'object' && submission.telemetry.manual_grades) {
        manualGrades = submission.telemetry.manual_grades;
      }
    }
    if (typeof manualGrades === 'string') {
      try { manualGrades = JSON.parse(manualGrades); } catch { manualGrades = {}; }
    }
    if (!manualGrades) manualGrades = {};

    const pendingWrittenQuestions = writtenQuestions.filter(q => !manualGrades[q.id]);
    const gradedWrittenQuestions = writtenQuestions.filter(q => !!manualGrades[q.id]);

    const hasPendingWritten = pendingWrittenQuestions.length > 0;
    const isFullyGraded = !hasPendingWritten;
    const isPurelyWritten = writtenQuestions.length > 0 && multipleQuestions.length === 0;
    const isPurelyObjective = writtenQuestions.length === 0;
    const isMixed = writtenQuestions.length > 0 && multipleQuestions.length > 0;

    let objectiveEarned = 0;
    let objectiveCorrectCount = 0;
    if (submission && submission.answers) {
      multipleQuestions.forEach(q => {
        const qPts = q.points !== undefined && q.points > 0 ? q.points : 1.0;
        const ans = submission.answers[q.id];
        const hasAns = ans !== undefined && ans !== null && ans !== '' && ans !== 'undefined';
        let expectedCorrect = q.correctOption;
        if (q.originalIndices && q.correctOption !== undefined) {
          expectedCorrect = q.originalIndices[q.correctOption];
        }
        if (hasAns && Number(ans) === expectedCorrect) {
          objectiveEarned += qPts;
          objectiveCorrectCount += 1;
        }
      });
    }

    let writtenEarned = 0;
    gradedWrittenQuestions.forEach(q => {
      const g = manualGrades[q.id];
      if (g) {
        writtenEarned += (g.pointsAwarded || 0);
      }
    });

    objectiveEarned = Math.round(objectiveEarned * 10) / 10;
    writtenEarned = Math.round(writtenEarned * 10) / 10;
    const totalEarned = Math.round((objectiveEarned + writtenEarned) * 10) / 10;

    return {
      hasPendingWritten,
      isFullyGraded,
      isPurelyWritten,
      isPurelyObjective,
      isMixed,
      totalQuestions: questions.length,
      multipleCount: multipleQuestions.length,
      writtenCount: writtenQuestions.length,
      pendingWrittenCount: pendingWrittenQuestions.length,
      gradedWrittenCount: gradedWrittenQuestions.length,
      totalExamPoints,
      objectivePoints,
      objectiveEarned,
      objectiveCorrectCount,
      writtenPoints,
      writtenEarned,
      totalEarned,
    };
  };

  const computeExamScore = (answersMap: Record<string, string | number>) => {
    const origExam = originalExamRef.current || (activeExam ? availableExams.find(e => e.id === activeExam.id) : null);
    const mapped = mapShuffledToOriginal(answersMap);
    if (origExam && origExam.questions) {
      return computeMasterExamScore(origExam.questions, mapped);
    }
    if (!activeExam || !activeExam.questions) return { score: 0, correctCount: 0, totalQuestions: 0 };
    return computeMasterExamScore(activeExam.questions, mapped);
  };

  const saveProgressToDb = async (answers: any, tele: any) => {
    const subId = currentSubmissionIdRef.current;
    if (!subId) return;
    try {
      const dbAnswers = mapShuffledToOriginal(answers || {});
      await supabase
        .from('wsm_mock_submissions')
        .update({
          answers: dbAnswers,
          telemetry: tele
        })
        .eq('id', subId);
    } catch (err) {
      console.error("Erro ao sincronizar progresso no banco:", err);
    }
  };

  const loadStudentSimulados = async () => {
    try {
      const cleanEmail = (email || '').toLowerCase().trim();

      // 1. Fetch virtual classes the student is enrolled in
      let studentVirtualClasses: any[] = [];
      try {
        const { data: dbVCls } = await supabase
          .from('wsm_virtual_classes')
          .select('*');
        if (dbVCls) {
          studentVirtualClasses = dbVCls.filter((vc: any) =>
            vc.student_emails &&
            vc.student_emails.map((e: string) => String(e).toLowerCase().trim()).includes(cleanEmail)
          );
        }
      } catch (vcErr) {
        console.warn("Could not load virtual classes in StudentSimulados:", vcErr);
      }

      // 2. Fetch submissions FIRST for this student email using case-insensitive ilike
      let parsedSubs: any[] = [];
      const { data: dbSubmissions, error: subErr } = await supabase
        .from('wsm_mock_submissions')
        .select('*')
        .ilike('student_email', cleanEmail)
        .order('submitted_at', { ascending: false });

      if (!subErr && dbSubmissions) {
        parsedSubs = dbSubmissions.map(sub => {
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
          if ((!mg || Object.keys(mg).length === 0) && tel && typeof tel === 'object' && tel.manual_grades) {
            mg = tel.manual_grades;
          }
          return {
            ...sub,
            telemetry: tel,
            manual_grades: mg || {}
          };
        });
        setMySubmissions(parsedSubs);
        setReviewSubmission(prev => {
          if (!prev) return null;
          const updated = parsedSubs.find((s: any) => s.id === prev.id || (prev.mock_exam_id && s.mock_exam_id === prev.mock_exam_id));
          return updated ? { ...prev, ...updated } : prev;
        });
      }

      const submittedExamIds = new Set(parsedSubs.map((s: any) => s.mock_exam_id).filter(Boolean));

      // 3. Fetch all mock exams (simulados) from DB
      let filteredExamsList: any[] = [];
      const { data: dbExams, error: exErr } = await supabase
        .from('wsm_mock_exams')
        .select('*')
        .order('created_at', { ascending: false });

      if (!exErr && dbExams) {
        // Find if studentClass matches any virtual class the student is in (by name or ID)
        const selectedVC = isRoomContext
          ? studentVirtualClasses.find((vc: any) => vc.name === studentClass || vc.id === studentClass)
          : undefined;

        const filteredExams = dbExams.filter((exam: any) => {
          // ALWAYS include exams that the student has already submitted or started
          if (submittedExamIds.has(exam.id)) return true;

          const { settings } = parseExamSettings(exam.description || '');
          if (settings.is_draft || exam.is_draft === true || exam.status === 'draft') return false;

          const target = exam.class_name;
          if (!target) return false;

          if (isRoomContext && selectedVC) {
            return matchesStudentTarget(
              target,
              cleanEmail,
              studentClass,
              [selectedVC.id, selectedVC.name, selectedVC.access_code]
            );
          }

          const studentVCIdentifiers: string[] = [];
          studentVirtualClasses.forEach((vc: any) => {
            if (vc.id) studentVCIdentifiers.push(vc.id);
            if (vc.name) studentVCIdentifiers.push(vc.name);
            if (vc.access_code) studentVCIdentifiers.push(vc.access_code);
          });

          return matchesStudentTarget(target, cleanEmail, studentClass, studentVCIdentifiers);
        });

        filteredExamsList = [...filteredExams];

        // Synthesize fallback exam objects for any submissions whose exam record might be missing
        parsedSubs.forEach(sub => {
          if (sub.mock_exam_id) {
            const exists = filteredExamsList.some((e: any) => e.id === sub.mock_exam_id);
            if (!exists) {
              const fallbackExam: any = {
                id: sub.mock_exam_id,
                title: sub.mock_exam_title || `Simulado (${sub.student_class || 'Realizado'})`,
                description: 'Simulado concluído.',
                subject: sub.subject || 'Geral',
                class_name: sub.student_class || '',
                questions: [],
                total_points: sub.total_questions || 10,
                created_at: sub.submitted_at || new Date().toISOString()
              };
              filteredExamsList.push(fallbackExam);
            }
          }
        });

        setAvailableExams(filteredExamsList);
      }

      // Auto trigger AI evaluation in background for any submission with pending AI written questions
      parsedSubs.forEach(sub => {
        if (!sub.telemetry?.is_unfinished) {
          const exam = filteredExamsList.find((e: any) => e.id === sub.mock_exam_id);
          if (exam) {
            processAiWrittenGradesWithRetry(
              sub.id,
              exam,
              sub.answers || {},
              sub.manual_grades || {},
              (updatedGrades, newScore, newCorrect) => {
                setMySubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, manual_grades: updatedGrades, score: newScore, correct_count: newCorrect } : s));
                setReviewSubmission(prev => prev && prev.id === sub.id ? { ...prev, manual_grades: updatedGrades, score: newScore, correct_count: newCorrect } : prev);
              }
            );
          }
        }
      });
    } catch (err) {
      console.error("Erro ao carregar simulados para o aluno:", err);
    }
  };

  useEffect(() => {
    loadStudentSimulados();
    const interval = setInterval(loadStudentSimulados, 7000);
    return () => clearInterval(interval);
  }, [email, studentClass]);

  // Track tab switches during active exam - ONLY for controlled exams
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && activeExam) {
        const { settings } = parseExamSettings(activeExam.description);
        const isControlled = settings.mode === 'controlled' || settings.is_controlled === true;
        if (isControlled) {
          const nextTelemetry = {
            ...telemetryRef.current,
            tabSwitches: telemetryRef.current.tabSwitches + 1
          };
          setTelemetry(nextTelemetry);
          saveProgressToDb(studentAnswersRef.current, nextTelemetry);
        } else {
          // Normal mode: do not flag tab switches as violations
          saveProgressToDb(studentAnswersRef.current, telemetryRef.current);
        }
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [activeExam]);

  // Warn on page reload/close when exam is active
  useEffect(() => {
    if (!activeExam) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const { settings } = parseExamSettings(activeExam.description);
      const isControlled = settings.mode === 'controlled' || settings.is_controlled === true;
      if (isControlled) {
        e.preventDefault();
        e.returnValue = "Você está no meio de um simulado controlado. Se você sair ou recarregar, sua tentativa será encerrada!";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [activeExam]);

  // Periodic interval (every 15s) to sync elapsed time and active question telemetry with database
  useEffect(() => {
    if (!activeExam) return;

    const interval = setInterval(() => {
      if (activeExam) {
        const totalTimeSpentSeconds = Math.round((Date.now() - examStartTimeRef.current) / 1000);
        const currentQId = activeExam.questions[examProgressIndexRef.current]?.id;
        const timeSpentOnCurrentQ = Math.round((Date.now() - questionStartTime) / 1000);

        const nextTelemetry = {
          ...telemetryRef.current,
          totalTimeSeconds: totalTimeSpentSeconds,
        };
        if (currentQId) {
          nextTelemetry.questionTimes = {
            ...nextTelemetry.questionTimes,
            [currentQId]: (nextTelemetry.questionTimes[currentQId] || 0) + timeSpentOnCurrentQ
          };
        }

        setTelemetry(nextTelemetry);
        saveProgressToDb(studentAnswersRef.current, nextTelemetry);
        setQuestionStartTime(Date.now()); // reset current slice
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [activeExam]);

  // Monitor violations limit to trigger auto-submit (2x or more tab switches / exits for CONTROLLED exams only)
  useEffect(() => {
    if (!activeExam) return;
    const { settings } = parseExamSettings(activeExam.description);
    const isControlled = settings.mode === 'controlled' || settings.is_controlled === true;
    if (isControlled && telemetry.tabSwitches >= 2) {
      handleViolationSubmit();
    }
  }, [telemetry.tabSwitches, activeExam]);

  // Fisher-Yates shuffle helper
  const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  };

  // Helper to trigger fullscreen
  const requestFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error("Erro ao solicitar tela cheia:", err);
      });
    }
  };

  const wasInFullscreenRef = useRef<boolean>(false);

  // Fullscreen monitor useEffect
  useEffect(() => {
    if (!activeExam) {
      setIsFullscreen(false);
      wasInFullscreenRef.current = false;
      return;
    }

    const { settings } = parseExamSettings(activeExam.description);
    const isCont = settings.is_controlled === true;
    if (!isCont) {
      setIsFullscreen(true); // Always true for normal exams to bypass fullscreen overlay & blur
      return;
    }

    const checkFullscreen = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (isFull) {
        wasInFullscreenRef.current = true;
      } else if (wasInFullscreenRef.current) {
        // Only trigger exit violation if student was actively in fullscreen previously
        const nextTelemetry = {
          ...telemetryRef.current,
          tabSwitches: telemetryRef.current.tabSwitches + 1
        };
        setTelemetry(nextTelemetry);
        saveProgressToDb(studentAnswersRef.current, nextTelemetry);

        logSystemAction({
          userEmail: email.toLowerCase(),
          userName: studentName,
          role: 'student',
          action: 'VIOLATION_FULLSCREEN',
          details: `Aluno saiu da tela cheia durante o simulado "${activeExam.title}".`,
          metadata: { examId: activeExam.id }
        }).catch(err => console.error(err));
      }
    };

    document.addEventListener('fullscreenchange', checkFullscreen);
    const initialIsFull = !!document.fullscreenElement;
    setIsFullscreen(initialIsFull);
    if (initialIsFull) {
      wasInFullscreenRef.current = true;
    }

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen);
    };
  }, [activeExam]);

  // Copy, Select, ContextMenu & print blockers
  useEffect(() => {
    if (!activeExam) return;

    const { settings } = parseExamSettings(activeExam.description);
    const isCont = settings.is_controlled === true;
    if (!isCont) return; // Skip blockers for normal exams

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        (e.ctrlKey && e.key === 'p') ||
        (e.metaKey && e.key === 'p') ||
        (e.ctrlKey && e.key === 'c') ||
        (e.metaKey && e.key === 'c') ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'PrintScreen') {
          alert("Captura de tela/PrintScreen não é permitida durante o simulado para manter a integridade da avaliação!");
        }
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeExam]);

  // Timer countdown useEffect
  useEffect(() => {
    if (!activeExam || examStartTime <= 0) return;

    const { settings } = parseExamSettings(activeExam.description);
    const durationMin = settings.duration_minutes || 0;

    if (durationMin <= 0) {
      setRemainingSeconds(-1);
      return;
    }

    const extraMin = settings.student_extra_time?.[email.toLowerCase()] || 0;
    const totalAllowedSeconds = (durationMin + extraMin) * 60;

    const updateTimer = () => {
      const elapsedSeconds = Math.floor((Date.now() - examStartTime) / 1000);
      const rem = Math.max(0, totalAllowedSeconds - elapsedSeconds);
      setRemainingSeconds(rem);

      if (rem === 0) {
        clearInterval(timerInterval);
        handleTimeoutSubmit();
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    return () => clearInterval(timerInterval);
  }, [activeExam, examStartTime]);

  // Start exam trigger - asks for single-attempt confirmation
  const handleStartExam = (exam: MockExam) => {
    setShowConfirmStart(exam);
  };

  // Actual confirm start exam inside modal
  const handleConfirmStartExam = async (exam: MockExam) => {
    setShowConfirmStart(null);
    setSubmitting(true);

    try {
      // 1. Check if they already have an existing submission for this exam
      const cleanEmail = (email || '').toLowerCase().trim();
      const { data: existing, error: exCheckErr } = await supabase
        .from('wsm_mock_submissions')
        .select('*')
        .eq('mock_exam_id', exam.id)
        .ilike('student_email', cleanEmail);

      let subIdToUse: string | null = null;
      let existingAnswers: Record<string, string | number> = {};
      let originalStartTime: string | null = null;
      let unfinishedSub: any = null;

      if (existing && existing.length > 0) {
        // Parse telemetry for each existing item first
        const parsedExisting = existing.map(sub => {
          let tel = sub.telemetry;
          if (typeof tel === 'string') {
            try {
              tel = JSON.parse(tel);
            } catch {
              tel = null;
            }
          }
          return {
            ...sub,
            telemetry: tel
          };
        });

        // Check if there is an unfinished attempt (resume / extra time)
        unfinishedSub = parsedExisting.find(sub => sub.telemetry?.is_unfinished === true);
        if (unfinishedSub) {
          subIdToUse = unfinishedSub.id;
          existingAnswers = unfinishedSub.answers || {};
          originalStartTime = unfinishedSub.telemetry?.started_at || unfinishedSub.submitted_at;
        } else {
          const { settings } = parseExamSettings(exam.description);
          if (settings.is_controlled === true) {
            setErrorMsg("Você já realizou este simulado ou iniciou uma tentativa anterior. Não é permitido entrar novamente.");
            setSubmitting(false);
            return;
          }
          // For uncontrolled exams, allow creating a new submission
        }
      }

      // Check if deadline has passed for new attempts
      if (!subIdToUse && exam.deadline) {
        if (new Date(exam.deadline).getTime() < Date.now()) {
          setErrorMsg(`O prazo para realização deste simulado foi encerrado em ${new Date(exam.deadline).toLocaleString('pt-BR')}. Não é mais possível iniciar este simulado.`);
          setSubmitting(false);
          return;
        }
      }

      // 2. Request fullscreen immediately inside the button click gesture if controlled
      const { settings } = parseExamSettings(exam.description);
      if (settings.is_controlled === true) {
        requestFullscreen();
      }

      // 3. Create or read the submission
      if (!subIdToUse) {
        const nowIso = new Date().toISOString();
        const initialPayload = {
          mock_exam_id: exam.id,
          student_email: email.toLowerCase(),
          student_name: studentName,
          student_class: studentClass,
          answers: {},
          score: 0.0,
          total_questions: exam.questions.length,
          correct_count: 0,
          telemetry: {
            totalTimeSeconds: 0,
            questionTimes: {},
            optionChanges: {},
            tabSwitches: 0,
            firstInteractionTime: nowIso,
            is_unfinished: true,
            started_at: nowIso
          },
          submitted_at: nowIso
        };

        const { data: inserted, error: insertErr } = await supabase
          .from('wsm_mock_submissions')
          .insert(initialPayload)
          .select('*')
          .single();

        if (insertErr || !inserted) {
          throw new Error("Erro ao registrar início do simulado no banco de dados: " + (insertErr?.message || "Tente novamente"));
        }
        subIdToUse = inserted.id;
        originalStartTime = nowIso;
      }

      setCurrentSubmissionId(subIdToUse);
      originalExamRef.current = exam;

      const shouldShuffleOptions = (exam.shuffle_options === true) || (settings.shuffle_options === true);
      const shouldShuffleQuestions = (exam.shuffle_questions === true) || (settings.shuffle_questions === true);

      // Shuffling logic
      let finalQuestions = (exam.questions || []).map(q => ({ ...q }));

      if (shouldShuffleOptions) {
        finalQuestions = finalQuestions.map(q => {
          if (q.type === 'multiple' && q.options && q.options.length > 0) {
            const optionsWithIdx = q.options.map((opt, idx) => ({ text: opt, originalIdx: idx }));
            const shuffled = shuffleArray(optionsWithIdx);

            const newOptions = shuffled.map(o => o.text);
            const originalIndices = shuffled.map(o => o.originalIdx);

            const originalCorrect = q.correctOption ?? 0;
            const newCorrectOption = originalIndices.indexOf(originalCorrect);

            return {
              ...q,
              options: newOptions,
              originalIndices: originalIndices,
              correctOption: newCorrectOption >= 0 ? newCorrectOption : 0
            };
          }
          return q;
        });
      }

      if (shouldShuffleQuestions) {
        finalQuestions = shuffleArray(finalQuestions);
      }

      const shuffledExam: MockExam = {
        ...exam,
        questions: finalQuestions
      };

      // State updates
      setActiveExam(shuffledExam);
      setStudentAnswers(mapOriginalToShuffled(existingAnswers, finalQuestions));
      setExamProgressIndex(0);
      setErrorMsg('');
      setSuccessMsg('');
      setTimeoutModalShown(false);

      let examStartTimestamp = Date.now();
      if (originalStartTime) {
        const startedAtMs = new Date(originalStartTime).getTime();
        if (!isNaN(startedAtMs)) {
          const wallClockElapsedSeconds = (Date.now() - startedAtMs) / 1000;
          const totalSavedSeconds = unfinishedSub?.telemetry?.totalTimeSeconds || 0;
          
          if (totalSavedSeconds > 0 && wallClockElapsedSeconds > totalSavedSeconds + 120) {
            examStartTimestamp = Date.now() - (totalSavedSeconds * 1000);
          } else {
            examStartTimestamp = startedAtMs;
          }
        }
      }
      setExamStartTime(examStartTimestamp);
      setQuestionStartTime(Date.now());

      setTelemetry({
        totalTimeSeconds: unfinishedSub?.telemetry?.totalTimeSeconds || 0,
        questionTimes: unfinishedSub?.telemetry?.questionTimes || {},
        optionChanges: unfinishedSub?.telemetry?.optionChanges || {},
        tabSwitches: unfinishedSub?.telemetry?.tabSwitches || 0,
        firstInteractionTime: unfinishedSub?.telemetry?.firstInteractionTime || originalStartTime || new Date().toISOString()
      });

      // Log start or resume action
      await logSystemAction({
        userEmail: email.toLowerCase(),
        userName: studentName,
        role: 'student',
        action: originalStartTime ? 'RESUME_SIMULADO' : 'START_SIMULADO',
        details: originalStartTime 
          ? `Retomou o simulado "${exam.title}".`
          : `Iniciou o simulado "${exam.title}".`,
        metadata: {
          examId: exam.id,
          title: exam.title
        }
      });

    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erro ao iniciar o simulado.");
    } finally {
      setSubmitting(false);
    }
  };

  // Keep answer choice
  const handleAnswerChange = (qId: string, answer: string | number) => {
    setStudentAnswers(prev => {
      const nextAnswers = {
        ...prev,
        [qId]: answer
      };
      
      let nextTelemetry = telemetryRef.current;
      if (prev[qId] !== undefined && prev[qId] !== answer) {
        nextTelemetry = {
          ...nextTelemetry,
          optionChanges: {
            ...nextTelemetry.optionChanges,
            [qId]: (nextTelemetry.optionChanges[qId] || 0) + 1
          }
        };
        setTelemetry(nextTelemetry);
      }
      
      saveProgressToDb(nextAnswers, nextTelemetry);
      return nextAnswers;
    });
  };

  const changeQuestion = (newIndex: number) => {
    if (!activeExam) return;
    
    // Save time spent on current question
    const currentQId = activeExam.questions[examProgressIndex].id;
    const timeSpentOnCurrentQ = Math.round((Date.now() - questionStartTime) / 1000);
    const totalTimeSpentSeconds = Math.round((Date.now() - examStartTime) / 1000);
    
    const nextTelemetry = {
      ...telemetryRef.current,
      totalTimeSeconds: totalTimeSpentSeconds,
      questionTimes: {
        ...telemetryRef.current.questionTimes,
        [currentQId]: (telemetryRef.current.questionTimes[currentQId] || 0) + timeSpentOnCurrentQ
      }
    };
    
    setTelemetry(nextTelemetry);
    saveProgressToDb(studentAnswersRef.current, nextTelemetry);
    
    // Reset timer for new question
    setQuestionStartTime(Date.now());
    setExamProgressIndex(newIndex);
  };

  // Auto-submit when time is over
  const handleTimeoutSubmit = async () => {
    if (!activeExam) return;
    setSubmitting(true);

    try {
      // Exit fullscreen safely
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.error("Error exiting fullscreen:", err));
      }

      const origExam = originalExamRef.current || availableExams.find(e => e.id === activeExam.id) || activeExam;
      const mappedAnswers = mapShuffledToOriginal(studentAnswers);
      const { score: finalGrade, correctCount, totalQuestions: totalQuestionsCount } = computeMasterExamScore(origExam.questions, mappedAnswers);

      const totalTimeSpentSeconds = Math.round((Date.now() - examStartTime) / 1000);

      const finalTelemetry = {
        ...telemetry,
        totalTimeSeconds: totalTimeSpentSeconds,
        is_unfinished: false, // Closed!
        timeout_submitted: true, // Flagged as submitted by timeout
        violation: false,
        violation_submitted: false
      };

      const submissionPayload = {
        answers: mappedAnswers,
        score: finalGrade,
        total_questions: totalQuestionsCount,
        correct_count: correctCount,
        telemetry: finalTelemetry,
        submitted_at: new Date().toISOString()
      };

      if (currentSubmissionId) {
        await supabase
          .from('wsm_mock_submissions')
          .update(submissionPayload)
          .eq('id', currentSubmissionId);
      } else {
        await supabase
          .from('wsm_mock_submissions')
          .insert({
            mock_exam_id: activeExam.id,
            student_email: email.toLowerCase(),
            student_name: studentName,
            student_class: studentClass,
            ...submissionPayload
          });
      }

      // Log student timeout submission
      await logSystemAction({
        userEmail: email.toLowerCase(),
        userName: studentName,
        role: 'student',
        action: 'TIMEOUT_SIMULADO',
        details: `Simulado "${activeExam.title}" finalizado automaticamente por estourar o tempo limite. Nota: ${finalGrade.toFixed(2)}`,
        metadata: {
          examId: activeExam.id,
          title: activeExam.title,
          score: finalGrade,
          timeout: true
        }
      });

      setActiveExam(null);
      setCurrentSubmissionId(null);
      setTimeoutModalShown(true);
      loadStudentSimulados();

    } catch (err) {
      console.error("Erro no envio por timeout:", err);
      setActiveExam(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit when screen/fullscreen violations limit is exceeded (2x or more)
  const handleViolationSubmit = async () => {
    if (!activeExam) return;
    setSubmitting(true);

    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.error("Error exiting fullscreen:", err));
      }

      const origExam = originalExamRef.current || availableExams.find(e => e.id === activeExam.id) || activeExam;
      const mappedAnswers = mapShuffledToOriginal(studentAnswers);
      const { score: finalGrade, correctCount, totalQuestions: totalQuestionsCount } = computeMasterExamScore(origExam.questions, mappedAnswers);

      const totalTimeSpentSeconds = Math.round((Date.now() - examStartTime) / 1000);

      const finalTelemetry = {
        ...telemetry,
        totalTimeSeconds: totalTimeSpentSeconds,
        is_unfinished: false, // Closed!
        violation: true, // Closed due to violation!
        violation_submitted: true
      };

      const submissionPayload = {
        answers: mappedAnswers,
        score: finalGrade,
        total_questions: totalQuestionsCount,
        correct_count: correctCount,
        telemetry: finalTelemetry,
        submitted_at: new Date().toISOString()
      };

      if (currentSubmissionId) {
        await supabase
          .from('wsm_mock_submissions')
          .update(submissionPayload)
          .eq('id', currentSubmissionId);
      } else {
        await supabase
          .from('wsm_mock_submissions')
          .insert({
            mock_exam_id: activeExam.id,
            student_email: email.toLowerCase(),
            student_name: studentName,
            student_class: studentClass,
            ...submissionPayload
          });
      }

      await logSystemAction({
        userEmail: email.toLowerCase(),
        userName: studentName,
        role: 'student',
        action: 'VIOLATION_AUTO_SUBMIT',
        details: `Simulado "${activeExam.title}" finalizado e entregue automaticamente por violações repetidas de tela cheia/abas (${telemetry.tabSwitches} saídas detectadas). Nota: ${finalGrade.toFixed(2)}`,
        metadata: {
          examId: activeExam.id,
          title: activeExam.title,
          score: finalGrade,
          violation: true
        }
      });

      setActiveExam(null);
      setCurrentSubmissionId(null);
      alert(`⚠️ SIMULADO ENCERRADO POR VIOLAÇÃO DE REGRA!\n\nFoi detectada a saída da tela da prova ou troca de aba.\n\nPara garantir a integridade dos testes, suas respostas marcadas até o momento foram enviadas para o seu professor.`);
      loadStudentSimulados();

    } catch (err: any) {
      console.error("Erro no envio por violação:", err);
      setActiveExam(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit via voluntary abandonment (treats as final submit, closes attempt)
  const handleAbandonSubmit = async () => {
    if (!activeExam) return;
    setSubmitting(true);

    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.error("Error exiting fullscreen:", err));
      }

      const origExam = originalExamRef.current || availableExams.find(e => e.id === activeExam.id) || activeExam;
      const mappedAnswers = mapShuffledToOriginal(studentAnswers);
      const { score: finalGrade, correctCount, totalQuestions: totalQuestionsCount } = computeMasterExamScore(origExam.questions, mappedAnswers);

      const totalTimeSpentSeconds = Math.round((Date.now() - examStartTime) / 1000);

      const finalTelemetry = {
        ...telemetry,
        totalTimeSeconds: totalTimeSpentSeconds,
        is_unfinished: false, // Closed!
        abandoned: true
      };

      const submissionPayload = {
        answers: mappedAnswers,
        score: finalGrade,
        total_questions: totalQuestionsCount,
        correct_count: correctCount,
        telemetry: finalTelemetry,
        submitted_at: new Date().toISOString()
      };

      if (currentSubmissionId) {
        await supabase
          .from('wsm_mock_submissions')
          .update(submissionPayload)
          .eq('id', currentSubmissionId);
      } else {
        await supabase
          .from('wsm_mock_submissions')
          .insert({
            mock_exam_id: activeExam.id,
            student_email: email.toLowerCase(),
            student_name: studentName,
            student_class: studentClass,
            ...submissionPayload
          });
      }

      await logSystemAction({
        userEmail: email.toLowerCase(),
        userName: studentName,
        role: 'student',
        action: 'ABANDON_SIMULADO',
        details: `Aluno abandonou voluntariamente o simulado "${activeExam.title}". Prova finalizada e entregue. Nota parcial: ${finalGrade.toFixed(2)}`,
        metadata: {
          examId: activeExam.id,
          title: activeExam.title,
          score: finalGrade,
          abandoned: true
        }
      });

      setActiveExam(null);
      setCurrentSubmissionId(null);
      alert(`Simulado finalizado por abandono voluntário. Suas respostas feitas até o momento foram salvas e enviadas.`);
      loadStudentSimulados();

    } catch (err: any) {
      console.error("Erro ao abandonar simulado:", err);
      setActiveExam(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Interactive Exam & execute auto-correction
  const handleSubmitExam = async () => {
    if (!activeExam) return;
    setErrorMsg('');
    setSubmitting(true);

    // Check for unanswered questions and ask for confirmation
    const unanswered = activeExam.questions.filter(q => {
      const a = studentAnswers[q.id];
      return a === undefined || a === null || a === '' || a === 'undefined';
    });
    if (unanswered.length > 0) {
      const confirmSubmit = window.confirm(
        `Você ainda possui ${unanswered.length} questão(ões) sem responder. As questões em branco serão consideradas incorretas.\n\nDeseja finalizar e entregar o simulado mesmo assim?`
      );
      if (!confirmSubmit) {
        setSubmitting(false);
        return;
      }
    }

    try {
      // Exit fullscreen safely
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.error("Error exiting fullscreen:", err));
      }

      const origExam = originalExamRef.current || availableExams.find(e => e.id === activeExam.id) || activeExam;
      const mappedAnswers = mapShuffledToOriginal(studentAnswers);
      const { score: finalGrade, correctCount, totalQuestions: totalQuestionsCount } = computeMasterExamScore(origExam.questions, mappedAnswers);
      const totalExamPoints = origExam.questions.reduce((sum, q) => sum + (q.points !== undefined && q.points > 0 ? q.points : 1.0), 0) || 10;
      
      // Complete telemetry
      const currentQId = activeExam.questions[examProgressIndex].id;
      const timeSpentOnCurrentQ = Math.round((Date.now() - questionStartTime) / 1000);
      const totalTimeSpentSeconds = Math.round((Date.now() - examStartTime) / 1000);
      
      const finalTelemetry = {
        ...telemetry,
        totalTimeSeconds: totalTimeSpentSeconds,
        questionTimes: {
          ...telemetry.questionTimes,
          [currentQId]: (telemetry.questionTimes[currentQId] || 0) + timeSpentOnCurrentQ
        },
        is_unfinished: false, // Closed!
        violation: false,
        violation_submitted: false
      };

      const submissionPayload = {
        mock_exam_id: activeExam.id,
        student_email: email.toLowerCase(),
        student_name: studentName,
        student_class: studentClass,
        answers: mappedAnswers,
        score: finalGrade,
        total_questions: totalQuestionsCount,
        correct_count: correctCount,
        telemetry: finalTelemetry,
        submitted_at: new Date().toISOString()
      };

      // Update existing if we have an active session id, otherwise insert
      let savedSubId = currentSubmissionId;
      if (currentSubmissionId) {
        const { error } = await supabase
          .from('wsm_mock_submissions')
          .update(submissionPayload)
          .eq('id', currentSubmissionId);
        if (error) throw error;
      } else {
        const { data: insertedData, error } = await supabase
          .from('wsm_mock_submissions')
          .insert(submissionPayload)
          .select('id')
          .single();
        if (error) throw error;
        if (insertedData) savedSubId = insertedData.id;
      }

      // Trigger silent AI grading in background with 5s retry loop
      if (savedSubId) {
        processAiWrittenGradesWithRetry(
          savedSubId,
          origExam,
          mappedAnswers,
          {},
          (updatedGrades, newScore, newCorrect) => {
            setReviewSubmission(prev => prev ? {
              ...prev,
              manual_grades: updatedGrades,
              score: newScore,
              correct_count: newCorrect
            } : null);
          }
        );
      }

      // Log student submission
      await logSystemAction({
        userEmail: email.toLowerCase(),
        userName: studentName,
        role: 'student',
        action: 'SUBMIT_SIMULADO',
        details: `Submeteu o simulado "${activeExam.title}". Gabarito: ${correctCount}/${totalQuestionsCount} acertos de múltipla escolha. Nota Objetiva: ${finalGrade.toFixed(2)} / ${totalExamPoints.toFixed(1)}`,
        metadata: {
          examId: activeExam.id,
          title: activeExam.title,
          score: finalGrade,
          correct: correctCount,
          total: totalQuestionsCount
        }
      });

      // Send immediate success message and review
      const writtenCount = origExam.questions.filter(q => q.type === 'written').length;
      const multipleCount = origExam.questions.filter(q => q.type === 'multiple').length;
      const hasWritten = writtenCount > 0;

      let successMsgText = '';
      if (hasWritten && multipleCount === 0) {
        successMsgText = `Simulado "${activeExam.title}" finalizado com sucesso! 📝 Questões discursivas enviadas para correção da professora.`;
      } else if (hasWritten && multipleCount > 0) {
        successMsgText = `Simulado "${activeExam.title}" finalizado com sucesso! Nota objetiva parcial: ${finalGrade.toFixed(1)} / ${totalExamPoints.toFixed(1)} pt(s). ⏳ Questões discursivas aguardando correção da professora.`;
      } else {
        successMsgText = `Simulado "${activeExam.title}" finalizado com sucesso! Nota calculada: ${finalGrade.toFixed(1)} / ${totalExamPoints.toFixed(1)} pt(s).`;
      }

      setSuccessMsg(successMsgText);
      setActiveExam(null);
      setCurrentSubmissionId(null);
      loadStudentSimulados();
      
      // Auto-open review of what they just made
      const reviewObj = {
        id: 'temp_rev_' + Date.now(),
        ...submissionPayload,
        submitted_at: new Date().toISOString()
      };
      setReviewExam(origExam);
      setReviewSubmission(reviewObj);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Erro ao enviar o simulado: ${err.message || 'Tente de novo.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Open existing submission review
  const handleOpenSubmissionReview = (exam: MockExam, submission: MockSubmission) => {
    setReviewExam(exam);
    setReviewSubmission(submission);
    setErrorMsg('');
    setSuccessMsg('');

    if (submission && exam) {
      processAiWrittenGradesWithRetry(
        submission.id,
        exam,
        submission.answers || {},
        submission.manual_grades || {},
        (updatedGrades, newScore, newCorrect) => {
          setMySubmissions(prev => prev.map(s => s.id === submission.id ? { ...s, manual_grades: updatedGrades, score: newScore, correct_count: newCorrect } : s));
          setReviewSubmission(prev => prev && prev.id === submission.id ? { ...prev, manual_grades: updatedGrades, score: newScore, correct_count: newCorrect } : prev);
        }
      );
    }
  };

  return (
    <div id="student-simulados-root" className="space-y-8 animate-fadeIn">
      {successMsg && (
        <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-400 animate-slideUp">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-950/20 border border-rose-500/25 rounded-2xl flex items-center gap-2.5 text-xs text-rose-400 animate-slideUp">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!activeExam && !reviewSubmission ? (
        /* LIST VIEW MODE */
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-neutral-950/20 border border-emerald-950/10 backdrop-blur-md">
            <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-400" />
              Simulados e Provas Virtuais Disponíveis
            </h2>
            <p className="text-neutral-400 text-xs mt-1">
              Faça simulados elaborados por seus professores de forma online. Obtenha nota em tempo real e verifique o gabarito comentado imediatamente ao submeter.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {/* Tabs header */}
              <div className="flex border-b border-neutral-900 pb-1 gap-6 mb-4">
                <button
                  onClick={() => setSimuladosSubTab('pendentes')}
                  className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all relative cursor-pointer flex items-center gap-1.5 ${
                    simuladosSubTab === 'pendentes'
                      ? 'text-emerald-400 font-extrabold'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <span>Disponíveis para Realizar</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    simuladosSubTab === 'pendentes' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-neutral-900 text-neutral-500'
                  }`}>
                    {availableExams.filter(exam => {
                      const sub = mySubmissions.find(s => s.mock_exam_id === exam.id);
                      return !sub || sub.telemetry?.is_unfinished === true;
                    }).length}
                  </span>
                  {simuladosSubTab === 'pendentes' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full animate-fadeIn" />
                  )}
                </button>
                <button
                  onClick={() => setSimuladosSubTab('realizados')}
                  className={`pb-2 text-xs font-bold uppercase tracking-wider transition-all relative cursor-pointer flex items-center gap-1.5 ${
                    simuladosSubTab === 'realizados'
                      ? 'text-emerald-400 font-extrabold'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  <span>Meus Simulados Concluídos</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    simuladosSubTab === 'realizados' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-neutral-900 text-neutral-500'
                  }`}>
                    {availableExams.filter(exam => {
                      const sub = mySubmissions.find(s => s.mock_exam_id === exam.id);
                      return sub && sub.telemetry?.is_unfinished !== true;
                    }).length}
                  </span>
                  {simuladosSubTab === 'realizados' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full animate-fadeIn" />
                  )}
                </button>
              </div>

              {simuladosSubTab === 'pendentes' ? (
                (() => {
                  const pendingExams = availableExams.filter(exam => {
                    const sub = mySubmissions.find(s => s.mock_exam_id === exam.id);
                    const isFinished = sub && sub.telemetry?.is_unfinished !== true;
                    const isDeadlinePassed = exam.deadline ? new Date(exam.deadline).getTime() < new Date().getTime() : false;

                    if (isFinished) return false;
                    // If deadline has passed and student is not resuming an active unfinished attempt, exclude from pending!
                    if (isDeadlinePassed && !sub?.telemetry?.is_unfinished) return false;

                    return true;
                  });
                  if (pendingExams.length === 0) {
                    return (
                      <div className="py-16 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20">
                        <BookOpen className="w-9 h-9 text-neutral-700 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-neutral-400">Nenhum simulado pendente.</p>
                        <p className="text-xs text-neutral-550 mt-1">Nenhum simulado pendente de resposta neste momento. Excelente trabalho!</p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pendingExams.map((exam) => {
                        const isDeadlinePassed = exam.deadline ? new Date(exam.deadline) < new Date() : false;
                        const subForExam = mySubmissions.find(s => s.mock_exam_id === exam.id);
                        const isResuming = subForExam?.telemetry?.is_unfinished === true;

                        return (
                          <div key={exam.id} className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-neutral-950/90 to-neutral-950 border border-emerald-500/50 hover:border-emerald-400 transition-all flex flex-col justify-between space-y-4 shadow-[0_0_25px_rgba(16,185,129,0.18)] hover:shadow-[0_0_35px_rgba(16,185,129,0.3)] relative overflow-hidden group">
                            {/* Glowing radial background highlight */}
                            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/25 transition-all" />

                            <div className="relative z-10 space-y-3">
                              {/* Top Active Badge & Deadline */}
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                  ⚡ SIMULADO DISPONÍVEL
                                </span>

                                <div className="flex items-center gap-1.5">
                                  {(() => {
                                    const { settings } = parseExamSettings(exam.description);
                                    const isCont = settings.mode === 'controlled' || settings.is_controlled === true;
                                    return (
                                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                                        isCont 
                                          ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      }`}>
                                        {isCont ? '🔒 Controlado' : '🟢 Ritmo Livre'}
                                      </span>
                                    );
                                  })()}
                                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full font-sans uppercase">
                                    {exam.subject}
                                  </span>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-extrabold text-neutral-100 group-hover:text-emerald-200 transition-colors">{exam.title}</h4>
                                <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">{parseExamSettings(exam.description).cleanDescription || "Sem instruções específicas."}</p>
                              </div>

                              {isResuming && (
                                <p className="text-[10px] text-amber-300 font-mono font-extrabold flex items-center gap-1 bg-amber-500/20 border border-amber-500/30 w-fit px-2.5 py-1 rounded-lg animate-pulse">
                                  ★ Tentativa em Andamento (Clique para Retomar)
                                </p>
                              )}

                              <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-neutral-400 pt-2 border-t border-emerald-900/40 gap-2">
                                {exam.deadline ? (
                                  <span className="flex items-center gap-1 text-emerald-300 font-bold bg-neutral-900/80 px-2 py-0.5 rounded border border-emerald-900/50">
                                    <Clock className="w-3 h-3 text-emerald-400 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                                    Prazo: {new Date(exam.deadline).toLocaleString('pt-BR')}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-neutral-400 font-semibold">
                                    <Clock className="w-3 h-3 text-neutral-500 shrink-0" />
                                    Sem prazo limite
                                  </span>
                                )}
                                <span className="text-neutral-500">
                                  {exam.questions?.length || 0} Questões • Prof. {exam.teacher_name || "Docente"}
                                </span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-emerald-900/30 flex items-center justify-between relative z-10">
                              {isDeadlinePassed && !isResuming ? (
                                <>
                                  <span className="text-[10px] text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">Prazo Expirado</span>
                                  <button disabled className="px-3 py-1.5 bg-neutral-950 text-neutral-600 rounded-lg text-xs font-semibold cursor-not-allowed border border-neutral-900">
                                    Fechado
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${isResuming ? 'text-amber-300 bg-amber-500/15 border-amber-500/30' : 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'}`}>
                                    {isResuming ? 'Em Andamento' : '🚨 Ação Requerida'}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {onStudyForExam && (
                                      <button
                                        onClick={() => {
                                          const { cleanDescription } = parseExamSettings(exam.description || '');
                                          onStudyForExam(exam.title, cleanDescription || exam.description || 'Assuntos do simulado');
                                        }}
                                        className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-850 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400 transition-all cursor-pointer shadow"
                                        title="Estudar e revisar este conteúdo com o tutor IA"
                                      >
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Estudar com IA</span>
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleStartExam(exam)}
                                      className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-98 ${
                                        isResuming 
                                          ? 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-amber-400/20'
                                          : 'bg-emerald-400 hover:bg-emerald-300 text-neutral-950 shadow-emerald-400/25 border border-emerald-300/40'
                                      }`}
                                    >
                                      <span>{isResuming ? 'Retomar Simulado' : 'Iniciar Simulado Agora'}</span>
                                      <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const completedExams = availableExams.filter(exam => {
                    const sub = mySubmissions.find(s => s.mock_exam_id === exam.id);
                    return sub && sub.telemetry?.is_unfinished !== true;
                  });
                  if (completedExams.length === 0) {
                    return (
                      <div className="py-16 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20">
                        <Trophy className="w-9 h-9 text-neutral-700 mx-auto mb-2 animate-bounce" />
                        <p className="text-sm font-semibold text-neutral-400">Nenhum simulado concluído ainda.</p>
                        <p className="text-xs text-neutral-550 mt-1">Os simulados que você realizar e enviar aparecerão aqui com as suas notas e gabaritos!</p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {completedExams.map((exam) => {
                        const submission = mySubmissions.find(sub => sub.mock_exam_id === exam.id)!;
                        const status = getExamSubmissionStatus(exam, submission);
                        
                        const scoreColor = status.hasPendingWritten
                          ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                          : submission.score >= 7.0 
                          ? 'text-emerald-450 border-emerald-500/20 bg-emerald-500/10' 
                          : 'text-amber-400 border-amber-500/20 bg-amber-500/10';

                        return (
                          <div key={exam.id} className="p-5 rounded-2xl bg-neutral-950/40 border border-neutral-900 hover:border-emerald-500/20 transition-all flex flex-col justify-between space-y-4">
                            <div>
                              <div className="flex justify-between items-start gap-2 mb-2">
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full font-sans uppercase">
                                  {exam.subject}
                                </span>
                                
                                {/* HIGHLY PROMINENT SCORE DISPLAY AT FIRST GLANCE */}
                                <div className={`text-xs font-mono font-extrabold px-2.5 py-1 rounded-lg border ${scoreColor} shadow-sm animate-fadeIn flex flex-col items-center shrink-0`}>
                                  <span className="text-[7px] text-neutral-400 uppercase tracking-wider font-semibold">
                                    {status.hasPendingWritten ? (status.isPurelyWritten ? 'Status' : 'Nota Parcial') : 'Nota'}
                                  </span>
                                  <span className="text-xs font-black flex items-center gap-1">
                                    {status.hasPendingWritten ? (
                                      status.isPurelyWritten ? (
                                        <span>— <span className="text-[10px] text-neutral-400 font-normal">/ {status.totalExamPoints.toFixed(1)}</span></span>
                                      ) : (
                                        <span>{status.objectiveEarned.toFixed(1)}* <span className="text-[10px] text-neutral-400 font-normal">/ {status.totalExamPoints.toFixed(1)}</span></span>
                                      )
                                    ) : (
                                      <span>{submission.score.toFixed(1)} <span className="text-[10px] text-neutral-400 font-normal">/ {status.totalExamPoints.toFixed(1)}</span></span>
                                    )}
                                  </span>
                                </div>
                              </div>

                              <h4 className="text-sm font-bold text-neutral-200">{exam.title}</h4>
                              <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{parseExamSettings(exam.description).cleanDescription || "Sem instruções específicas."}</p>
                              
                              <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-neutral-500">
                                {status.hasPendingWritten ? (
                                  status.isPurelyWritten ? (
                                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                                      ⏳ Aguardando correção manual
                                    </span>
                                  ) : (
                                    <span className="text-amber-400 font-medium">
                                      {status.objectiveCorrectCount} acerto(s) obj. • ⏳ {status.pendingWrittenCount} discursiva(s) pendente(s)
                                    </span>
                                  )
                                ) : (
                                  <span>{submission.correct_count} de {submission.total_questions} acertos</span>
                                )}
                                <span>Concluído em: {new Date(submission.submitted_at).toLocaleDateString('pt-BR')}</span>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-neutral-900/65 flex items-center justify-between gap-2">
                              {status.hasPendingWritten ? (
                                <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                                  ⏳ Pendente
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded">
                                  Corrigido
                                </span>
                              )}
                              
                              <div className="flex gap-2">
                                {parseExamSettings(exam.description).settings.is_controlled === false && (
                                  <button
                                    onClick={() => handleStartExam(exam)}
                                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-md"
                                  >
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                    <span>Refazer</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenSubmissionReview(exam, submission)}
                                  className="px-3.5 py-1.5 bg-neutral-900 border border-neutral-800 hover:border-emerald-500/30 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95"
                                >
                                  <Eye className="w-4 h-4 text-emerald-400" />
                                  <span>Ver Gabarito</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Side column: Achievements review card */}
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/5 to-emerald-600/5 border border-emerald-500/15">
                <h4 className="text-xs uppercase font-extrabold tracking-wider text-emerald-400 flex items-center gap-1">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  <span>Sua Performance Geral</span>
                </h4>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center p-3 bg-neutral-950/40 rounded-xl border border-neutral-900">
                    <span className="text-[10px] text-neutral-500 uppercase block mb-1">Simulados Feitos</span>
                    <span className="text-xl font-mono font-bold text-neutral-200">{mySubmissions.length}</span>
                  </div>
                  <div className="text-center p-3 bg-neutral-950/40 rounded-xl border border-neutral-900">
                    <span className="text-[10px] text-neutral-500 uppercase block mb-1">Média de nota</span>
                    {(() => {
                      // Filter only submissions that are fully graded or have no pending written questions
                      const gradedSubmissions = mySubmissions.filter(sub => {
                        const exam = availableExams.find(ex => ex.id === sub.mock_exam_id);
                        const status = getExamSubmissionStatus(exam, sub);
                        return !status.hasPendingWritten;
                      });

                      const avg = gradedSubmissions.length > 0 
                        ? (gradedSubmissions.reduce((a, b) => a + b.score, 0) / gradedSubmissions.length).toFixed(1)
                        : mySubmissions.length > 0 ? "—" : "0.0";

                      return (
                        <span className="text-xl font-mono font-extrabold text-emerald-400">
                          {avg}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Recent activity timeline */}
              <div className="p-5 rounded-2xl bg-neutral-950/50 border border-neutral-900">
                <h4 className="text-xs font-bold text-neutral-300 mb-3">Histórico de Envios Recentes</h4>
                {mySubmissions.length === 0 ? (
                  <p className="text-[11px] text-neutral-550 leading-relaxed font-sans">Nenhuma atividade de simulado submetida ainda. Realize seus compromissos no painel principal.</p>
                ) : (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {mySubmissions.map((sub, sIdx) => {
                      const exam = availableExams.find(ex => ex.id === sub.mock_exam_id);
                      const examName = exam?.title || "Simulado";
                      const status = getExamSubmissionStatus(exam, sub);
                      return (
                        <div key={sub.id} className="p-2.5 bg-neutral-950 border border-neutral-900 rounded-lg text-[11px] flex justify-between items-center gap-2">
                          <div className="truncate max-w-[120px]">
                            <p className="font-bold text-neutral-350 truncate">{examName}</p>
                            <span className="text-[9px] text-neutral-550 font-mono">{new Date(sub.submitted_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                          {status.hasPendingWritten ? (
                            <span className="font-mono font-bold px-1.5 py-0.5 rounded text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20">
                              {status.isPurelyWritten ? '⏳ Pendente' : `⏳ ${status.objectiveEarned.toFixed(1)}*`}
                            </span>
                          ) : (
                            <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${sub.score >= 7 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {sub.score.toFixed(1)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeExam ? (
        /* ACTIVE EXAM INTERACTIVE FORM TAKING MODE */
        <div className="fixed inset-0 z-[9999] bg-neutral-950 overflow-y-auto p-4 md:p-8 select-none">
          {/* Inject style tag to disable standard print layout */}
          <style>{`
            @media print {
              body {
                display: none !important;
              }
            }
          `}</style>

          {/* WARNING OVERLAY IF NOT FULLSCREEN */}
          {!isFullscreen && (
            <div className="fixed inset-0 z-[10000] bg-neutral-950/80 backdrop-blur-xl flex items-center justify-center p-4">
              <div className="bg-neutral-900 border border-red-500/30 rounded-3xl p-8 max-w-lg w-full text-center space-y-6 shadow-2xl animate-scaleUp">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                  <ShieldAlert className="w-8 h-8 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-neutral-100">Você está violando as regras da plataforma.</h3>
                  <p className="text-amber-400 text-xs font-semibold">
                    Você pode estar consultando outras abas durante o simulado.
                  </p>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Por favor, deixe em tela cheia novamente e continue a fazer seu simulado, sem consulta à web. Iremos avisar o(a) professor(a) o ocorrido.
                </p>
                <button
                  onClick={requestFullscreen}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-xl text-xs font-extrabold cursor-pointer transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Monitor className="w-4 h-4" />
                  <span>Retornar para Tela Cheia</span>
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE EXAM INNER CONTAINER (Blurred if not fullscreen) */}
          <div className={`max-w-3xl mx-auto space-y-6 ${!isFullscreen ? 'blur-md pointer-events-none' : ''}`}>
            <div className="p-5 rounded-3xl bg-neutral-950 border border-neutral-900 backdrop-blur-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[9px] font-mono tracking-wider text-emerald-400 uppercase font-semibold font-bold">Simulado Online Sendo Realizado</span>
                <h3 className="text-base font-bold text-neutral-100 mt-1">{activeExam.title}</h3>
                <p className="text-xs text-neutral-555 font-mono mt-0.5">Disciplina: {activeExam.subject} • Professor(a): {activeExam.teacher_name}</p>
              </div>
              
              <div className="flex items-center gap-3 flex-wrap">
                {remainingSeconds !== -1 && (
                  <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl px-3 py-1.5 shrink-0">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-mono font-bold text-neutral-200">
                      {showTimer ? (() => {
                        const seconds = remainingSeconds;
                        const h = Math.floor(seconds / 3600);
                        const m = Math.floor((seconds % 3600) / 60);
                        const s = seconds % 60;
                        const pad = (n: number) => n.toString().padStart(2, '0');
                        return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
                      })() : "••:••"}
                    </span>
                    <button
                      onClick={() => setShowTimer(!showTimer)}
                      className="text-neutral-500 hover:text-neutral-300 p-0.5 transition-colors cursor-pointer"
                      title={showTimer ? "Ocultar Cronômetro" : "Mostrar Cronômetro"}
                    >
                      {showTimer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                <button
                  onClick={handleSubmitExam}
                  disabled={submitting}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs cursor-pointer transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{submitting ? "Enviando..." : "Finalizar e Entregar Prova"}</span>
                </button>

                <button
                  onClick={() => {
                    if (window.confirm("Deseja sair do simulado agora? Sua prova será entregue com as respostas já marcadas.")) {
                      handleAbandonSubmit();
                    }
                  }}
                  className="px-3 py-2 bg-neutral-900 border border-neutral-800 hover:text-red-400 text-neutral-400 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                  title="Sair da prova"
                >
                  Sair
                </button>
              </div>
            </div>

            {/* Progress bar visualizer */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-neutral-550">
                <span>Questão {examProgressIndex + 1} de {activeExam.questions.length}</span>
                <span>{Math.round(((examProgressIndex) / activeExam.questions.length) * 100)}% concluído</span>
              </div>
              <div className="w-full bg-neutral-900 p-0.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-400 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${((examProgressIndex + 1) / activeExam.questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Current Question panel */}
            {(() => {
              const currentQ = activeExam.questions[examProgressIndex];
              if (!currentQ) return null;
              const currentAnswer = studentAnswers[currentQ.id];

              return (
                <div className="p-8 rounded-3xl bg-neutral-950/60 border border-neutral-900 backdrop-blur-md space-y-6 animate-fadeIn">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 bg-neutral-900 text-neutral-450 border border-neutral-850 font-bold font-mono text-[10px] rounded">
                      PERGUNTA {examProgressIndex + 1} • {currentQ.type === 'multiple' ? 'MÚLTIPLA ESCOLA' : 'DISCURSIVA (ESCREVER)'}
                    </span>
                    {currentQ.isEnem && (
                      <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 font-extrabold font-mono text-[10px] rounded flex items-center gap-1 animate-pulse">
                        ⚡ ENEM {currentQ.enemYear || ""}
                      </span>
                    )}
                  </div>

                  <p className="text-sm md:text-base font-semibold text-neutral-250 leading-relaxed max-w-full whitespace-pre-wrap font-sans">{currentQ.text}</p>

                  {currentQ.imageUrls && currentQ.imageUrls.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-lg mx-auto">
                      {currentQ.imageUrls.map((img, imgIdx) => (
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
                  ) : currentQ.imageUrl ? (
                    <div 
                      className="rounded-2xl border border-neutral-900 overflow-hidden bg-neutral-950 p-2 max-h-72 w-fit mx-auto cursor-zoom-in group relative"
                      onClick={() => window.dispatchEvent(new CustomEvent('wsm-open-image-fullscreen', { detail: currentQ.imageUrl }))}
                      title="Clique para ampliar"
                    >
                      <img src={currentQ.imageUrl} alt="Ilustração da pergunta" className="max-h-64 object-contain group-hover:scale-[1.02] transition-transform duration-300" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                        <span className="text-xs font-bold text-white bg-black/60 px-2 py-1 rounded-lg">Ampliar 🔍</span>
                      </div>
                    </div>
                  ) : null}

                  {/* Multiple choice rendering options as elegant button selectors */}
                  {currentQ.type === 'multiple' && currentQ.options && (
                    <div className="space-y-3">
                      {currentQ.options.map((option, choiceIdx) => {
                        const isSelected = currentAnswer !== undefined && Number(currentAnswer) === choiceIdx;
                        return (
                          <button
                            key={choiceIdx}
                            onClick={() => handleAnswerChange(currentQ.id, choiceIdx)}
                            className={`w-full p-4 border rounded-2xl text-left text-xs font-semibold flex items-center justify-between gap-4 transition-all hover:bg-neutral-900/40 cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500/5 text-emerald-300 border-emerald-500/40'
                                : 'bg-neutral-950 border-neutral-900 text-neutral-400'
                            }`}
                          >
                            <span className="flex-1 leading-normal whitespace-pre-wrap">{String.fromCharCode(65 + choiceIdx)}) {option}</span>
                            <div className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected 
                                ? 'bg-emerald-400 border-emerald-405 text-neutral-900' 
                                : 'bg-transparent border-neutral-800'
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5 font-black stroke-[3px]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Written text answer box */}
                  {currentQ.type === 'written' && (
                    <div className="space-y-2">
                      <label className="block text-[10px] uppercase font-bold tracking-wider text-neutral-500 mb-1">Escreva abaixo sua resposta de forma clara e objetiva:</label>
                      <textarea
                        placeholder="Redija aqui sua resposta discursiva..."
                        rows={5}
                        value={currentAnswer !== undefined ? String(currentAnswer) : ''}
                        onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                        className="w-full px-4 py-3 bg-neutral-950 border border-neutral-850 focus:border-emerald-500/50 rounded-2xl text-xs text-neutral-200 outline-none placeholder-neutral-655 resize-none leading-relaxed"
                      />
                    </div>
                  )}

                  {/* Nav tools inside exam taking */}
                  <div className="flex justify-between items-center pt-6 border-t border-neutral-900/60 mt-4 [content-visibility:auto]">
                    <button
                      onClick={() => changeQuestion(Math.max(0, examProgressIndex - 1))}
                      disabled={examProgressIndex === 0}
                      className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 disabled:opacity-0 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      Anterior
                    </button>

                    {examProgressIndex < activeExam.questions.length - 1 ? (
                      <button
                        onClick={() => changeQuestion(examProgressIndex + 1)}
                        className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-850 hover:border-neutral-750 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer mb-2"
                      >
                        <span>Entendido, Próxima</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={handleSubmitExam}
                        disabled={submitting}
                        className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>{submitting ? "Corrigindo e enviando..." : "Finalizar Simulado"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        /* DETAILED REVIEW MODE (GABARITO COMENTADO IMMEDIATELY SHOWN) */
        <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
          <div className="p-5 rounded-3xl bg-neutral-950 border border-neutral-900 backdrop-blur-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 font-mono tracking-widest block">Gabarito e Revisão de Simulado</span>
              <h3 className="text-base font-bold text-neutral-100 mt-1">{reviewExam?.title}</h3>
              <p className="text-[11px] text-neutral-500 mt-0.5 font-mono">Realizado por: {studentName} • Turma: {studentClass} • Nota de acertos</p>
            </div>
            
            <button
              onClick={() => {
                setReviewExam(null);
                setReviewSubmission(null);
              }}
              className="px-4 py-2 bg-neutral-900 border border-neutral-850 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Início</span>
            </button>
          </div>

          {/* Highlight performance banner */}
          {reviewSubmission && reviewExam && (() => {
            const status = getExamSubmissionStatus(reviewExam, reviewSubmission);

            if (status.hasPendingWritten) {
              if (status.isPurelyWritten) {
                return (
                  <div className="p-6 rounded-3xl bg-neutral-950 border border-amber-500/20 flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-4 gap-y-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl shrink-0">
                        <Clock className="w-6 h-6 text-amber-400 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-amber-300">Envio Concluído • Aguardando Correção da Professora</h4>
                        <p className="text-xs text-neutral-400 mt-1">Suas respostas discursivas foram salvas e aguardam a avaliação da professora.</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center sm:items-end">
                      <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold block mb-1">Nota Geral</p>
                      <p className="font-mono text-3xl font-extrabold text-amber-400 flex items-baseline gap-1">
                        <span>—</span>
                        <span className="text-sm text-neutral-500 font-normal">/ {status.totalExamPoints.toFixed(1)}</span>
                      </p>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full mt-1.5 flex items-center gap-1">
                        ⏳ Correção Manual Pendente
                      </span>
                    </div>
                  </div>
                );
              }

              // Mixed: multiple choice + pending written
              return (
                <div className="p-6 rounded-3xl bg-neutral-950 border border-amber-500/20 flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-4 gap-y-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl shrink-0">
                      <Clock className="w-6 h-6 text-amber-400 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-300">Correção Parcial • Aguardando Discursivas</h4>
                      <p className="text-xs text-neutral-400 mt-1">A nota das questões de múltipla escolha foi calculada. As questões discursivas estão aguardando correção.</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center sm:items-end">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-semibold">
                        Objetiva: {status.objectiveEarned.toFixed(1)} / {status.objectivePoints.toFixed(1)}
                      </span>
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-semibold">
                        Discursiva: ⏳ {status.pendingWrittenCount} pendente(s)
                      </span>
                    </div>
                    <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold block">Nota Geral Parcial</p>
                    <p className="font-mono text-3xl font-extrabold text-amber-400 flex items-baseline gap-1">
                      <span>{status.objectiveEarned.toFixed(1)}*</span>
                      <span className="text-sm text-neutral-500 font-normal">/ {status.totalExamPoints.toFixed(1)}</span>
                    </p>
                    <span className="text-[10px] text-neutral-400 block mt-0.5">({status.objectiveCorrectCount} de {status.multipleCount} acertos obj. • *Nota Parcial)</span>
                  </div>
                </div>
              );
            }

            // Fully graded
            return (
              <div className="p-6 rounded-3xl bg-neutral-950 border border-neutral-900 flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-4 gap-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl shrink-0">
                    <Trophy className="w-6 h-6 text-emerald-400 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-250">Correção Concluída!</h4>
                    <p className="text-xs text-neutral-500 mt-1">Todas as questões foram avaliadas e sua nota foi consolidada.</p>
                  </div>
                </div>
                <div className="flex flex-col items-center sm:items-end">
                  {status.writtenCount > 0 && status.multipleCount > 0 && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-semibold">
                        Objetiva: {status.objectiveEarned.toFixed(1)} / {status.objectivePoints.toFixed(1)}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-semibold">
                        Discursiva: +{status.writtenEarned.toFixed(1)} / {status.writtenPoints.toFixed(1)}
                      </span>
                    </div>
                  )}
                  <p className="text-[9px] text-neutral-500 uppercase tracking-widest font-bold block mb-1">Nota Geral</p>
                  <p className="font-mono text-3xl font-extrabold text-emerald-400 flex items-baseline gap-1">
                    <span>{reviewSubmission.score.toFixed(1)}</span>
                    <span className="text-sm text-neutral-500 font-normal">/ {status.totalExamPoints.toFixed(1)}</span>
                  </p>
                  <span className="text-[10px] text-neutral-450 block mt-1">({reviewSubmission.correct_count} de {reviewSubmission.total_questions} acertos)</span>
                </div>
              </div>
            );
          })()}

          {/* Questions overview */}
          <div className="space-y-6 pt-2">
            <h4 className="text-xs font-mono uppercase tracking-widest text-neutral-550 border-b border-neutral-900 pb-2">Lista das Perguntas Solucionadas</h4>
            {reviewExam?.questions?.map((q, idx) => {
              const studentAnswer = reviewSubmission?.answers?.[q.id];
              const qPts = q.points !== undefined && q.points > 0 ? q.points : 1.0;
              const hasStudentAnswer = studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== '' && studentAnswer !== 'undefined';
              const isCorrect = q.type === 'multiple' && hasStudentAnswer && Number(studentAnswer) === q.correctOption;
              const manualGrade = reviewSubmission?.manual_grades?.[q.id] || reviewSubmission?.telemetry?.manual_grades?.[q.id];

              return (
                <div key={q.id} className="p-6 rounded-3xl bg-neutral-950/60 border border-neutral-900 backdrop-blur-md space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-neutral-500">
                        QUESTÃO {idx + 1} ({q.type === 'multiple' ? 'Múltipla Escolha' : 'Discursiva'}) • Valendo {qPts} pt(s)
                      </span>
                      {q.isEnem && (
                        <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-extrabold rounded-lg">
                          ⚡ ENEM {q.enemYear || ""}
                        </span>
                      )}
                    </div>
                    {q.type === 'multiple' ? (
                      !hasStudentAnswer ? (
                        <span className="px-2.5 py-0.5 bg-neutral-800 border border-neutral-700 text-neutral-400 text-[10px] font-bold rounded-lg">
                          Não Respondida (0.0 pt)
                        </span>
                      ) : isCorrect ? (
                        <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg flex items-center gap-1">
                          Correto ✔️ (+{qPts.toFixed(1)} pt)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-red-400 text-[10px] font-bold rounded-lg flex items-center gap-1">
                          Incorreto ❌ (+0.0 pt)
                        </span>
                      )
                    ) : (
                      manualGrade ? (
                        <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg border ${
                          manualGrade.status === 'correct'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : manualGrade.status === 'half'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}>
                          Avaliado: +{manualGrade.pointsAwarded.toFixed(1)} pt(s)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold rounded-lg animate-pulse">
                          ⏳ Aguardando Correção da Professora
                        </span>
                      )
                    )}
                  </div>

                  <p className="text-xs md:text-sm font-semibold text-neutral-250 leading-relaxed whitespace-pre-wrap font-sans">{q.text}</p>
                  
                  {q.imageUrls && q.imageUrls.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 mt-2 w-full max-w-lg">
                      {q.imageUrls.map((img, imgIdx) => (
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
                  ) : q.imageUrl ? (
                    <div 
                      className="rounded-xl border border-neutral-900 overflow-hidden max-h-48 w-fit bg-neutral-950 p-1 cursor-zoom-in group relative"
                      onClick={() => window.dispatchEvent(new CustomEvent('wsm-open-image-fullscreen', { detail: q.imageUrl }))}
                      title="Clique para ampliar"
                    >
                      <img src={q.imageUrl} alt="Questão ilustração" className="max-h-44 object-contain group-hover:scale-[1.02] transition-transform duration-300" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                        <span className="text-xs font-bold text-white bg-black/60 px-2 py-1 rounded-lg">Ampliar 🔍</span>
                      </div>
                    </div>
                  ) : null}

                  {/* Multiple Choice Color coded */}
                  {q.type === 'multiple' && q.options && (
                    <div className="space-y-2 mt-3">
                      {q.options.map((option, oIdx) => {
                        const isStudentChoice = hasStudentAnswer && Number(studentAnswer) === oIdx;
                        const isCorrectChoice = q.correctOption === oIdx;

                        let style = "bg-neutral-950 border-neutral-900 text-neutral-450";
                        if (isStudentChoice && isCorrectChoice) {
                          style = "bg-emerald-500/5 border-emerald-500/35 text-emerald-300 font-semibold";
                        } else if (isStudentChoice && !isCorrectChoice) {
                          style = "bg-red-500/5 border-red-500/35 text-red-350 font-semibold";
                        } else if (isCorrectChoice) {
                          style = "bg-emerald-500/5 border-emerald-500/10 text-emerald-450";
                        }

                        return (
                          <div key={oIdx} className={`p-3 border rounded-xl text-xs flex justify-between items-center gap-4 ${style}`}>
                            <span className="whitespace-pre-wrap">{String.fromCharCode(65 + oIdx)}) {option}</span>
                            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wide">
                              {isStudentChoice && <span className="font-extrabold">Sua Resposta</span>}
                              {isCorrectChoice && <span className="text-emerald-400 font-extrabold">[Gabarito]</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Written Answer styling */}
                  {q.type === 'written' && (
                    <div className="space-y-3">
                      <div className="p-4 bg-neutral-950 border border-neutral-900 rounded-2xl">
                        <p className="text-[9px] uppercase tracking-widest font-mono font-bold text-neutral-500 block mb-1">Sua resposta escrita:</p>
                        <p className="text-xs text-neutral-300 italic whitespace-pre-wrap">{studentAnswer ? String(studentAnswer) : 'Nenhuma resposta inserida.'}</p>
                      </div>

                      {/* Manual Grade feedback display for student */}
                      {manualGrade ? (
                        <div className="p-4 bg-neutral-900/50 border border-emerald-500/20 rounded-2xl space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-400 font-mono uppercase tracking-wider flex items-center gap-1">
                              {manualGrade.gradedBy === 'ai' ? (
                                <span>🤖 Correção Automática por IA (Athenas AI):</span>
                              ) : (
                                <span>📝 Avaliação da Professora:</span>
                              )}
                            </span>
                            <span className="text-xs font-extrabold text-emerald-300 font-mono">
                              +{manualGrade.pointsAwarded.toFixed(1)} / {qPts.toFixed(1)} pt(s)
                            </span>
                          </div>
                          {manualGrade.comment && (
                            <p className="text-xs text-neutral-300 italic bg-neutral-950 p-2.5 rounded-xl border border-neutral-850">
                              💬 "{manualGrade.comment}"
                            </p>
                          )}
                        </div>
                      ) : q.correctionType === 'ai' ? (
                        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between gap-2">
                          <span className="text-xs text-emerald-300 font-bold flex items-center gap-1.5 font-mono">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                            <span>🤖 Processando Correção por IA...</span>
                          </span>
                          <span className="text-[10px] text-neutral-400 font-mono">Em breve atualizado</span>
                        </div>
                      ) : (
                        <div className="p-3 bg-neutral-950 border border-neutral-900 rounded-xl text-[11px] text-neutral-500 font-mono italic">
                          📝 Questão aguardando avaliação manual da professora no painel.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Feedback commented */}
                  {q.explanation && (
                    <div className="p-3.5 bg-neutral-900/40 border border-neutral-900 rounded-xl mt-3 text-xs text-neutral-400 leading-normal">
                      <strong className="text-emerald-400">Gabarito comentado:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-5">
            <button
              onClick={() => {
                setReviewExam(null);
                setReviewSubmission(null);
              }}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
            >
              Concluir Revisão
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION START EXAM MODAL */}
      {showConfirmStart && (() => {
        const { settings } = parseExamSettings(showConfirmStart.description);
        const isCont = settings.is_controlled === true;

        return (
          <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className={`bg-neutral-950 border ${isCont ? 'border-red-500/30' : 'border-emerald-500/30'} rounded-3xl p-8 max-w-lg w-full text-center space-y-6 shadow-2xl animate-scaleUp`}>
              <div className={`w-16 h-16 ${isCont ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'} rounded-full flex items-center justify-center mx-auto border`}>
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-neutral-100">
                  {isCont ? 'Simulado de Tentativa Única!' : 'Iniciar Simulado'}
                </h3>
                <p className={`${isCont ? 'text-amber-400' : 'text-emerald-400'} text-xs font-semibold`}>
                  {isCont ? 'Você só pode entrar neste simulado 1 vez.' : 'Modo de Ritmo Livre & Tentativas Flexíveis.'}
                </p>
              </div>
              <p className="text-neutral-400 text-xs leading-relaxed">
                {isCont 
                  ? 'Uma vez iniciado, você DEVE concluir a prova até o fim. Caso saia da página, feche o navegador, ou abandone, sua tentativa será finalizada e enviada automaticamente com as respostas salvas e nota calculada.'
                  : 'Você pode realizar o simulado tranquilamente no seu próprio ritmo. Suas respostas serão salvas e enviadas com segurança ao finalizar.'
                }
              </p>
              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={() => setShowConfirmStart(null)}
                  className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleConfirmStartExam(showConfirmStart)}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-xl text-xs font-extrabold cursor-pointer transition-all flex items-center gap-2 shadow-lg"
                >
                  <span>{isCont ? 'Iniciar e Deixar em Tela Cheia' : 'Iniciar Simulado'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TIMEOUT NOTIFICATION MODAL */}
      {timeoutModalShown && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-neutral-950 border border-amber-500/30 rounded-3xl p-8 max-w-lg w-full text-center space-y-6 shadow-2xl animate-scaleUp">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
              <Clock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-neutral-100">O tempo acabou!</h3>
              <p className="text-neutral-400 text-xs">
                O tempo limite deste simulado foi atingido.
              </p>
            </div>
            <p className="text-emerald-405 text-emerald-400 text-xs font-semibold leading-relaxed">
              Suas respostas feitas até o momento foram salvas e enviadas automaticamente para o professor.
            </p>
            <button
              onClick={() => setTimeoutModalShown(false)}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 rounded-xl text-xs font-bold cursor-pointer transition-all mx-auto block shadow-md"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
