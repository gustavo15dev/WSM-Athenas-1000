import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Check, 
  X, 
  Sparkles, 
  Layers, 
  FileText, 
  HelpCircle, 
  Filter,
  CheckSquare,
  Square,
  ArrowRight
} from 'lucide-react';
import { MockExamQuestion } from '../types';

interface PersonalQuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  personalQuestions: MockExamQuestion[];
  currentExamQuestions: MockExamQuestion[];
  onImportQuestion: (question: MockExamQuestion) => void;
  onImportMultipleQuestions: (questions: MockExamQuestion[]) => void;
  teacherName?: string;
}

export default function PersonalQuestionBankModal({
  isOpen,
  onClose,
  personalQuestions,
  currentExamQuestions,
  onImportQuestion,
  onImportMultipleQuestions,
  teacherName = 'Professor'
}: PersonalQuestionBankModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'multiple' | 'written'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Set of current questions normalized texts to check duplicates in current exam
  const currentNormalizedTexts = useMemo(() => {
    const set = new Set<string>();
    currentExamQuestions.forEach(q => {
      if (q && q.text) {
        set.add(q.text.trim().toLowerCase().replace(/\s+/g, ' '));
      }
    });
    return set;
  }, [currentExamQuestions]);

  // Strict deduplication helper on personal questions list
  const deduplicatedQuestions = useMemo(() => {
    const result: MockExamQuestion[] = [];
    const seenTexts = new Set<string>();

    personalQuestions.forEach(q => {
      if (!q || !q.text || !q.text.trim()) return;
      const normalized = q.text.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!seenTexts.has(normalized)) {
        seenTexts.add(normalized);
        result.push(q);
      }
    });

    return result;
  }, [personalQuestions]);

  // Filtered list based on search and type
  const filteredQuestions = useMemo(() => {
    return deduplicatedQuestions.filter(q => {
      const normQuery = searchTerm.trim().toLowerCase();
      const textMatch = !normQuery || q.text.toLowerCase().includes(normQuery) || (q.explanation && q.explanation.toLowerCase().includes(normQuery));
      const typeMatch = typeFilter === 'all' || q.type === typeFilter;
      return textMatch && typeMatch;
    });
  }, [deduplicatedQuestions, searchTerm, typeFilter]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      const newSet = new Set<string>();
      filteredQuestions.forEach(q => {
        const norm = q.text.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!currentNormalizedTexts.has(norm)) {
          newSet.add(q.id);
        }
      });
      setSelectedIds(newSet);
    }
  };

  const toggleSelectQuestion = (qId: string) => {
    const next = new Set(selectedIds);
    if (next.has(qId)) {
      next.delete(qId);
    } else {
      next.add(qId);
    }
    setSelectedIds(next);
  };

  const handleImportSelected = () => {
    const questionsToImport = deduplicatedQuestions.filter(q => selectedIds.has(q.id));
    if (questionsToImport.length > 0) {
      onImportMultipleQuestions(questionsToImport);
      setSelectedIds(new Set());
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-6xl bg-neutral-950 border border-emerald-500/30 rounded-3xl shadow-[0_0_80px_rgba(16,185,129,0.22)] flex flex-col max-h-[92vh] overflow-hidden"
        >
          {/* Header Banner */}
          <div className="p-5 sm:p-7 border-b border-neutral-900 bg-neutral-900/40 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Background Glow */}
            <div className="absolute top-0 right-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 shrink-0 flex items-center justify-center">
                <div className="w-full h-full bg-neutral-950 rounded-[14px] flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-extrabold text-neutral-100 font-display">
                    Banco de Questões Pessoal do Professor
                  </h2>
                  <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    Acervo Exclusivo
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Questões criadas e aplicadas em seus simulados anteriores • <strong className="text-emerald-400 font-semibold">Sem duplicatas ({deduplicatedQuestions.length} únicas)</strong>
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 sm:static p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all cursor-pointer z-20"
              title="Fechar Banco de Questões"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controls / Filter Bar */}
          <div className="p-4 sm:p-5 border-b border-neutral-900 bg-neutral-950/80 space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative w-full md:w-96">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Pesquisar por palavras-chave ou enunciado..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-neutral-900/80 border border-neutral-800 focus:border-emerald-500/50 rounded-xl text-xs text-neutral-200 outline-none placeholder-neutral-500 transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Type Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-xl w-full md:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    typeFilter === 'all' ? 'bg-emerald-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Todas ({deduplicatedQuestions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('multiple')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    typeFilter === 'multiple' ? 'bg-emerald-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Múltipla Escolha ({deduplicatedQuestions.filter(q => q.type === 'multiple').length})
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('written')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    typeFilter === 'written' ? 'bg-emerald-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Discursivas ({deduplicatedQuestions.filter(q => q.type === 'written').length})
                </button>
              </div>
            </div>

            {/* Select All & Import Selected Banner */}
            <div className="flex items-center justify-between text-xs font-mono text-neutral-400 pt-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-neutral-300 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  {selectedIds.size > 0 && selectedIds.size === filteredQuestions.length ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-neutral-500" />
                  )}
                  <span>Selecionar todas as visíveis ({filteredQuestions.length})</span>
                </button>
              </div>

              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleImportSelected}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all animate-pulse"
                >
                  <Plus className="w-4 h-4" />
                  <span>Importar {selectedIds.size} Selecionada(s)</span>
                </button>
              )}
            </div>
          </div>

          {/* Questions Scrollable Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
            {filteredQuestions.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-neutral-300">Nenhuma questão encontrada no seu acervo</h4>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  {searchTerm 
                    ? 'Tente ajustar os termos da sua busca ou filtros.'
                    : 'As questões que você criar nos seus simulados aparecerão automaticamente aqui para reutilização futura sem duplicatas!'}
                </p>
              </div>
            ) : (
              filteredQuestions.map((q, idx) => {
                const normText = q.text ? q.text.trim().toLowerCase().replace(/\s+/g, ' ') : '';
                const isAlreadyAdded = currentNormalizedTexts.has(normText);
                const isChecked = selectedIds.has(q.id);

                return (
                  <div
                    key={q.id || `bank-q-${idx}`}
                    className={`p-5 rounded-2xl transition-all border relative flex flex-col space-y-4 ${
                      isAlreadyAdded
                        ? 'bg-neutral-900/30 border-emerald-500/20 opacity-85'
                        : isChecked
                        ? 'bg-emerald-950/20 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                        : 'bg-neutral-900/50 border-neutral-800/80 hover:border-neutral-700'
                    }`}
                  >
                    {/* Header line */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {!isAlreadyAdded && (
                          <button
                            type="button"
                            onClick={() => toggleSelectQuestion(q.id)}
                            className="text-neutral-500 hover:text-emerald-400 cursor-pointer pt-0.5"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-neutral-600" />
                            )}
                          </button>
                        )}
                        <span className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-400">
                          Questão #{idx + 1}
                        </span>
                        <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md border ${
                          q.type === 'written' 
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {q.type === 'written' ? 'Discursiva' : 'Múltipla Escolha'}
                        </span>
                        {q.isEnem && (
                          <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            ENEM {q.enemYear || ''}
                          </span>
                        )}
                      </div>

                      {/* Action Button */}
                      <div>
                        {isAlreadyAdded ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl font-mono">
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            Já no Simulado
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onImportQuestion(q)}
                            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-neutral-950 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Adicionar</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Question Text */}
                    <div className="space-y-2">
                      <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed font-sans whitespace-pre-line font-medium">
                        {q.text}
                      </p>

                      {/* Attached images */}
                      {(q.imageUrl || (q.imageUrls && q.imageUrls.length > 0)) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {(q.imageUrls || [q.imageUrl]).map((img, imgIdx) => (
                            img ? (
                              <img
                                key={imgIdx}
                                src={img}
                                alt={`Anexo ${imgIdx + 1}`}
                                className="max-h-36 rounded-xl border border-neutral-800 object-cover bg-neutral-950"
                              />
                            ) : null
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Options if Multiple Choice */}
                    {q.type === 'multiple' && q.options && q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt, oIdx) => {
                          const isCorrect = q.correctOption === oIdx;
                          return (
                            <div
                              key={oIdx}
                              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                                isCorrect
                                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200 font-semibold'
                                  : 'bg-neutral-950/60 border-neutral-850 text-neutral-400'
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ${
                                isCorrect ? 'bg-emerald-500 text-neutral-950' : 'bg-neutral-850 text-neutral-400'
                              }`}>
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span className="line-clamp-2">{opt || 'Sem texto'}</span>
                              {isCorrect && (
                                <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-850 text-[11px] text-neutral-400 space-y-0.5">
                        <strong className="text-emerald-400 font-mono block">Explicação do Gabarito:</strong>
                        <p className="line-clamp-2">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-4 sm:p-5 border-t border-neutral-900 bg-neutral-950 flex items-center justify-between gap-4">
            <span className="text-xs text-neutral-400 font-mono">
              Mostrando <strong className="text-emerald-400">{filteredQuestions.length}</strong> de {deduplicatedQuestions.length} questões no acervo pessoal
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold rounded-xl text-xs transition-all cursor-pointer border border-neutral-800"
              >
                Concluído
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
