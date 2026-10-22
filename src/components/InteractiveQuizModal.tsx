import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Award, 
  RotateCcw, 
  Send, 
  Sparkles, 
  AlertCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';

export interface QuizQuestionOption {
  letter: string;
  text: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: QuizQuestionOption[];
  correctOption: string;
  explanation: string;
}

export interface QuizData {
  title: string;
  theme?: string;
  questions: QuizQuestion[];
}

export function extractQuizData(content?: string): QuizData | null {
  if (!content) return null;
  const match = content.match(/<wsm_quiz_data>([\s\S]*?)<\/wsm_quiz_data>/i);
  if (!match) return null;

  let raw = match[1].trim();
  if (raw.startsWith('```json')) raw = raw.slice(7);
  else if (raw.startsWith('```')) raw = raw.slice(3);
  if (raw.endsWith('```')) raw = raw.slice(0, -3);
  raw = raw.trim();

  // 1. Direct parse attempt
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return parsed as QuizData;
    }
  } catch {}

  // 2. Control character & string repair (fixes literal unescaped newlines/tabs inside string literals)
  try {
    let inString = false;
    let escaped = false;
    let fixed = '';
    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      if (char === '"' && !escaped) {
        inString = !inString;
        fixed += char;
      } else if (inString) {
        if (char === '\n') {
          fixed += '\\n';
        } else if (char === '\r') {
          // skip
        } else if (char === '\t') {
          fixed += ' ';
        } else if (char === '\\') {
          const next = raw[i + 1];
          if (!next || !'"/\\bfnrtu'.includes(next)) {
            fixed += '\\\\';
          } else {
            fixed += char;
          }
        } else {
          fixed += char;
        }
      } else {
        fixed += char;
      }
      escaped = (char === '\\' && !escaped);
    }

    const parsed = JSON.parse(fixed);
    if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return parsed as QuizData;
    }
  } catch {}

  // 3. Regex Fallback: extract questions directly from text in case JSON is still malformed
  try {
    const titleMatch = raw.match(/"title"\s*:\s*"([^"]+)"/i);
    const themeMatch = raw.match(/"theme"\s*:\s*"([^"]+)"/i);
    const title = titleMatch ? titleMatch[1] : 'Quiz Interativo Athenas';
    const theme = themeMatch ? themeMatch[1] : undefined;

    const qChunks = raw.split(/\{\s*"id"/i).slice(1);
    if (qChunks.length > 0) {
      const questions: QuizQuestion[] = [];
      qChunks.forEach((chunk, idx) => {
        const qTextMatch = chunk.match(/"question"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"options"|"\s*,\s*"correctOption")/i);
        const correctMatch = chunk.match(/"correctOption"\s*:\s*"([A-D])"/i);
        const explMatch = chunk.match(/"explanation"\s*:\s*"([\s\S]*?)"\s*[\}\]]/i);

        const options: QuizQuestionOption[] = [];
        const optMatches = chunk.matchAll(/\{\s*"letter"\s*:\s*"([A-D])"\s*,\s*"text"\s*:\s*"([\s\S]*?)"\s*\}/gi);
        for (const opt of optMatches) {
          options.push({ letter: opt[1], text: opt[2].replace(/\\n/g, ' ').replace(/\n/g, ' ').trim() });
        }

        if (qTextMatch && correctMatch && options.length >= 2) {
          questions.push({
            id: idx + 1,
            question: qTextMatch[1].replace(/\\n/g, ' ').replace(/\n/g, ' ').trim(),
            options,
            correctOption: correctMatch[1],
            explanation: explMatch ? explMatch[1].replace(/\\n/g, ' ').replace(/\n/g, ' ').trim() : 'Revise este conceito com a IA Athenas.'
          });
        }
      });

      if (questions.length >= 3) {
        return { title, theme, questions };
      }
    }
  } catch {}

  return null;
}

export function stripQuizDataTag(content?: string): string {
  if (!content) return '';
  return content
    .replace(/<wsm_quiz_data>[\s\S]*?<\/wsm_quiz_data>/gi, '')
    .trim();
}

export const QuizLauncherCard: React.FC<{ quiz: QuizData; onStart: () => void }> = ({ quiz, onStart }) => {
  return (
    <div className="w-full my-3 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-[#0e1626] to-[#0c1f1f]/80 border border-emerald-500/35 shadow-xl shadow-black/40 relative overflow-hidden group">
      {/* Background glow decoration */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/15 transition-all duration-500" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 font-mono tracking-wide uppercase">
              {quiz.questions?.length || 5} Questões
            </span>
          </div>

          <h4 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
            {quiz.title || "Quiz Interativo Athenas"}
          </h4>
          
          <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed">
            {quiz.theme ? `Avalie seus conhecimentos sobre ${quiz.theme}. Cada questão conta com explicações didáticas instantâneas.` : 'Teste seus conhecimentos neste desafio interativo com feedback passo a passo e dicas conceituais.'}
          </p>
        </div>

        <div className="shrink-0 pt-1 sm:pt-0">
          <button
            type="button"
            onClick={onStart}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 hover:shadow-emerald-900/50 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>Iniciar Quiz</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface InteractiveQuizModalProps {
  quiz: QuizData;
  onClose: () => void;
  onSendToAi: (reportText: string) => void;
}

export const InteractiveQuizModal: React.FC<InteractiveQuizModalProps> = ({
  quiz,
  onClose,
  onSendToAi,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState<boolean>(false);
  const [confirmExit, setConfirmExit] = useState<boolean>(false);

  const totalQuestions = quiz.questions?.length || 5;
  const currentQuestion = quiz.questions?.[currentIndex];

  // Calculation of statistics
  const currentAnswer = selectedAnswers[currentIndex];
  const isCurrentAnswered = currentAnswer !== undefined;

  let correctCount = 0;
  let wrongCount = 0;
  Object.entries(selectedAnswers).forEach(([qIdxStr, chosenLetter]) => {
    const qIdx = parseInt(qIdxStr, 10);
    const q = quiz.questions?.[qIdx];
    if (q) {
      if (chosenLetter === q.correctOption) {
        correctCount++;
      } else {
        wrongCount++;
      }
    }
  });

  const finalScore = totalQuestions > 0 ? ((correctCount / totalQuestions) * 10).toFixed(1) : '0.0';
  const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const handleSelectOption = (letter: string) => {
    // If question is already answered, prevent changing choice to preserve immediate feedback integrity
    if (isCurrentAnswered) return;

    setSelectedAnswers(prev => ({
      ...prev,
      [currentIndex]: letter
    }));
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowResults(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleRestart = () => {
    setSelectedAnswers({});
    setCurrentIndex(0);
    setShowResults(false);
  };

  const handleSendReport = () => {
    const formattedQuestions = quiz.questions.map((q, idx) => {
      const chosen = selectedAnswers[idx] || 'Não respondida';
      const isRight = chosen === q.correctOption;
      const chosenOpt = q.options?.find(o => o.letter === chosen);
      const correctOpt = q.options?.find(o => o.letter === q.correctOption);

      return `**Questão ${idx + 1}:** ${q.question}
- **Minha resposta:** ${chosen}) ${chosenOpt ? chosenOpt.text : ''} ${isRight ? '✅ (Correta)' : '❌ (Incorreta)'}
${!isRight ? `- **Gabarito oficial:** ${q.correctOption}) ${correctOpt ? correctOpt.text : ''}\n` : ''}- **Dica/Explicação:** ${q.explanation}`;
    }).join('\n\n');

    const reportMessage = `📋 **Quiz Concluído: ${quiz.title || 'Quiz com IA Athenas'}**
• **Pontuação:** ${correctCount} de ${totalQuestions} acertos (${scorePercentage}%)
• **Nota Final:** ${finalScore} / 10

Aqui está o meu relatório com todas as perguntas, minhas respostas e as explicações:

${formattedQuestions}

---
Athenas, analise o meu desempenho neste quiz! Me diga onde me saí bem, quais conceitos eu preciso reforçar e me dê dicas práticas do que estudar para melhorar!`;

    onSendToAi(reportMessage);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#090d16] text-slate-100 flex flex-col h-full w-full overflow-hidden select-none"
      >
        {/* Top Header Bar */}
        <div className="w-full border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between shrink-0 gap-4">
          {/* Brand & Theme */}
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h2 className="text-sm font-bold text-white tracking-tight truncate leading-tight">
                {quiz.title || 'Quiz Interativo Athenas'}
              </h2>
              <span className="text-[11px] text-emerald-400/80 font-medium">
                {quiz.theme ? `Tema: ${quiz.theme}` : 'Avaliação Rápida'}
              </span>
            </div>
          </div>

          {/* Central Progress Bar & Badges (Visible during the quiz) */}
          {!showResults && (
            <div className="flex-1 max-w-xl mx-auto flex items-center gap-3 sm:gap-4 px-2">
              {/* Segmented Progress Bar */}
              <div className="flex-1 flex items-center gap-1.5">
                {Array.from({ length: totalQuestions }).map((_, idx) => {
                  const answered = selectedAnswers[idx] !== undefined;
                  const isCurrent = idx === currentIndex;
                  const isCorrect = answered && selectedAnswers[idx] === quiz.questions?.[idx]?.correctOption;

                  let segmentBg = 'bg-slate-800';
                  if (answered) {
                    segmentBg = isCorrect ? 'bg-emerald-500' : 'bg-red-500';
                  } else if (isCurrent) {
                    segmentBg = 'bg-emerald-400/60 animate-pulse';
                  }

                  return (
                    <div
                      key={idx}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${segmentBg}`}
                    />
                  );
                })}
              </div>

              {/* Counter "X / 5" */}
              <div className="text-xs font-mono font-bold text-slate-300 shrink-0 tabular-nums">
                {currentIndex + 1} / {totalQuestions}
              </div>

              {/* Error Badge */}
              <div className="shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold font-mono">
                <span>✕</span>
                <span className="tabular-nums">{wrongCount}</span>
              </div>

              {/* Success Badge */}
              <div className="shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
                <span>✓</span>
                <span className="tabular-nums">{correctCount}</span>
              </div>
            </div>
          )}

          {/* Close button */}
          <div className="shrink-0 flex items-center">
            <button
              type="button"
              onClick={() => {
                if (Object.keys(selectedAnswers).length > 0 && !showResults) {
                  setConfirmExit(true);
                } else {
                  onClose();
                }
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              title="Fechar Quiz"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 md:py-8 flex justify-center items-start">
          <div className="w-full max-w-3xl">
            {!showResults ? (
              /* ACTIVE QUESTION VIEW */
              currentQuestion ? (
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col space-y-6"
                >
                  {/* Question Header */}
                  <div>
                    <span className="text-xs md:text-sm font-semibold tracking-wider text-emerald-400 uppercase font-mono">
                      Pergunta {currentIndex + 1}
                    </span>
                    <h3 className="text-lg md:text-xl font-semibold text-white leading-relaxed mt-1 select-text">
                      {currentQuestion.question}
                    </h3>
                  </div>

                  {/* Options List */}
                  <div className="flex flex-col space-y-3.5">
                    {currentQuestion.options?.map((option) => {
                      const isSelected = currentAnswer === option.letter;
                      const isCorrect = currentQuestion.correctOption === option.letter;
                      const showFeedback = isCurrentAnswered;

                      let cardStyle = "bg-slate-900/60 border-slate-800 hover:border-emerald-500/40 hover:bg-slate-800/50 text-slate-200 cursor-pointer";
                      
                      if (showFeedback) {
                        if (isCorrect) {
                          // This is the correct option
                          cardStyle = "bg-emerald-950/30 border-emerald-500/80 text-emerald-100 shadow-sm shadow-emerald-950/40";
                        } else if (isSelected && !isCorrect) {
                          // User selected wrong option
                          cardStyle = "bg-red-950/25 border-red-500/80 text-red-100 shadow-sm shadow-red-950/40";
                        } else {
                          // Unselected other option
                          cardStyle = "bg-slate-900/30 border-slate-800/60 text-slate-400 opacity-60 pointer-events-none";
                        }
                      }

                      return (
                        <div
                          key={option.letter}
                          onClick={() => handleSelectOption(option.letter)}
                          className={`p-4 md:p-5 rounded-2xl border transition-all duration-200 ${cardStyle}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              {/* Option Letter */}
                              <span className={`text-base font-bold shrink-0 ${
                                showFeedback && isCorrect
                                  ? 'text-emerald-400'
                                  : showFeedback && isSelected && !isCorrect
                                    ? 'text-red-400'
                                    : 'text-slate-300'
                              }`}>
                                {option.letter}.
                              </span>

                              {/* Option Text & Subtitle */}
                              <div className="flex flex-col">
                                <span className={`text-[14.5px] md:text-[15px] font-medium leading-relaxed select-text ${
                                  showFeedback && isCorrect
                                    ? 'text-emerald-50 font-semibold'
                                    : showFeedback && isSelected && !isCorrect
                                      ? 'text-red-100'
                                      : 'text-slate-200'
                                }`}>
                                  {option.text}
                                </span>

                                {showFeedback && isSelected && (
                                  <span className={`text-xs mt-0.5 font-medium ${
                                    isCorrect ? 'text-emerald-400/90' : 'text-red-400/90'
                                  }`}>
                                    (Sua resposta)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Status Badge */}
                            {showFeedback && isCorrect && (
                              <div className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                                <Check className="w-3.5 h-3.5" />
                                <span>Resposta correta</span>
                              </div>
                            )}

                            {showFeedback && isSelected && !isCorrect && (
                              <div className="shrink-0 px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                                <X className="w-3.5 h-3.5" />
                                <span>Resposta incorreta</span>
                              </div>
                            )}
                          </div>

                          {/* Explanation Tip Revealed underneath option (for the correct answer, or user's answer) */}
                          {showFeedback && (isCorrect || isSelected) && currentQuestion.explanation && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              transition={{ duration: 0.25 }}
                              className={`mt-3.5 pt-3 border-t text-[13.5px] leading-relaxed select-text ${
                                isCorrect
                                  ? 'border-emerald-500/20 text-slate-300'
                                  : 'border-red-500/20 text-slate-300'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <HelpCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                                  isCorrect ? 'text-emerald-400' : 'text-amber-400'
                                }`} />
                                <p>{currentQuestion.explanation}</p>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-12 text-slate-400">Questão não encontrada.</div>
              )
            ) : (
              /* RESULTS SUMMARY SCREEN */
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center space-y-6 text-center py-4"
              >
                {/* Trophy & Grade Hero */}
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/60 mx-auto">
                    <Award className="w-10 h-10" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-black font-extrabold text-xs shadow-md">
                    {scorePercentage}%
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                    Quiz Finalizado!
                  </h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto">
                    {scorePercentage >= 80 
                      ? "Parabéns! Excelente domínio do tema, você demonstrou sólido conhecimento."
                      : scorePercentage >= 60 
                        ? "Bom trabalho! Você teve uma boa pontuação, com alguns pontos a reforçar."
                        : "Boa tentativa! Use a análise da IA Athenas para fixar o que você errou."}
                  </p>
                </div>

                {/* Score Stats Cards */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-md">
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col items-center">
                    <span className="text-xs text-slate-400 font-medium">Nota</span>
                    <span className="text-xl font-bold text-white mt-0.5 font-mono tabular-nums">{finalScore}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col items-center">
                    <span className="text-xs text-emerald-400 font-medium">Acertos</span>
                    <span className="text-xl font-bold text-emerald-400 mt-0.5 font-mono tabular-nums">{correctCount}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/30 flex flex-col items-center">
                    <span className="text-xs text-red-400 font-medium">Erros</span>
                    <span className="text-xl font-bold text-red-400 mt-0.5 font-mono tabular-nums">{wrongCount}</span>
                  </div>
                </div>

                {/* Detailed Questions Breakdown List */}
                <div className="w-full text-left space-y-3 pt-2">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono px-1">
                    Gabarito das Questões
                  </h4>
                  <div className="space-y-2.5">
                    {quiz.questions?.map((q, idx) => {
                      const chosen = selectedAnswers[idx];
                      const isRight = chosen === q.correctOption;
                      const chosenOpt = q.options?.find(o => o.letter === chosen);
                      const correctOpt = q.options?.find(o => o.letter === q.correctOption);

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border text-sm flex flex-col gap-1.5 ${
                            isRight
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-slate-200'
                              : 'bg-red-950/15 border-red-500/30 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-white">
                              Questão {idx + 1}: {q.question.length > 70 ? q.question.substring(0, 70) + '...' : q.question}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isRight
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-red-500/20 text-red-300'
                            }`}>
                              {isRight ? 'Acertou ✓' : 'Errou ✕'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                            <span>Sua escolha: <strong className={isRight ? 'text-emerald-300' : 'text-red-300'}>{chosen}) {chosenOpt?.text || 'Em branco'}</strong></span>
                            {!isRight && <span>Gabarito: <strong className="text-emerald-300">{q.correctOption}) {correctOpt?.text}</strong></span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CTA Action Buttons */}
                <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleSendReport}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-950/50 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar quiz respondido pra IA</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRestart}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-slate-400" />
                    <span>Refazer Quiz</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-800 hover:bg-slate-800/80 text-slate-400 hover:text-white font-medium text-sm cursor-pointer transition-colors"
                  >
                    <span>Voltar ao Chat</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Bottom Navigation Toolbar (Only when in question view) */}
        {!showResults && (
          <div className="w-full border-t border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between shrink-0">
            {/* Left side: Back button */}
            <div>
              {currentIndex > 0 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-5 py-2.5 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
              ) : (
                <div />
              )}
            </div>

            {/* Right side: Advance / Finish Button */}
            <div className="flex items-center gap-3">
              {!isCurrentAnswered && (
                <span className="text-xs text-slate-400 hidden sm:inline-block">
                  Selecione uma alternativa para avançar
                </span>
              )}

              <button
                type="button"
                onClick={handleNext}
                disabled={!isCurrentAnswered}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 shadow-md cursor-pointer ${
                  isCurrentAnswered
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-[0.98]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                }`}
              >
                <span>{currentIndex === totalQuestions - 1 ? 'Ver Resultado' : 'Avançar'}</span>
                {currentIndex === totalQuestions - 1 ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Confirm Exit Modal Dialog */}
        {confirmExit && (
          <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-amber-400">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <h4 className="text-base font-bold text-white">Sair do Quiz?</h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Você já respondeu {Object.keys(selectedAnswers).length} de {totalQuestions} questões. Se você fechar agora, o progresso deste quiz não será enviado à IA.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmExit(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                >
                  Continuar Respondendo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmExit(false);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600/80 hover:bg-red-600 text-white transition-colors cursor-pointer"
                >
                  Sair do Quiz
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
