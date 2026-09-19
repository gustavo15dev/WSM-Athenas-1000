/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Sparkles, 
  Play, 
  Clock, 
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { parseExamSettings, cleanExamContent, formatExamDateDisplay, cleanExamObservations, extractExamTime } from '../utils/examSettings';

interface StudentCalendarProps {
  exams: any[];
  mockExams: any[];
  onStudyForExam: (title: string, content: string) => void;
  onTakeMockExam: () => void;
}

export default function StudentCalendar({ 
  exams, 
  mockExams, 
  onStudyForExam, 
  onTakeMockExam 
}: StudentCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Helper to get days in month
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const totalDays = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  // Trailing days of previous month
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthDaysCount = getDaysInMonth(prevYear, prevMonth);

  const prevMonthDays = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    prevMonthDays.push({
      day: prevMonthDaysCount - i,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
    });
  }

  // Days of current month
  const currentMonthDays = [];
  for (let i = 1; i <= totalDays; i++) {
    currentMonthDays.push({
      day: i,
      month,
      year,
      isCurrentMonth: true,
    });
  }

  // Next month leading days
  const remainingCells = 42 - (prevMonthDays.length + currentMonthDays.length);
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const nextMonthDays = [];
  for (let i = 1; i <= remainingCells; i++) {
    nextMonthDays.push({
      day: i,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
    });
  }

  const allCalendarDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  // Map dates to daily items
  const getEventsForDate = (y: number, m: number, d: number) => {
    const formattedMonth = String(m + 1).padStart(2, '0');
    const formattedDay = String(d).padStart(2, '0');
    const dateStr = `${y}-${formattedMonth}-${formattedDay}`;

    // Standard exams
    const dayExams = exams.filter(ex => {
      if (!ex.exam_date) return false;
      const exStr = ex.exam_date.substring(0, 10);
      const [exY, exM, exD] = exStr.split('-').map(Number);
      return exY === y && (exM - 1) === m && exD === d;
    });

    // Mock Exams (Online simulations) with deadlines fall on deadline day
    const dayMockExams = mockExams.filter(me => {
      if (!me.deadline) return false;
      const meStr = me.deadline.substring(0, 10);
      // Depending on whether it's stored as local or UTC, 
      // but me.deadline is TIMESTAMPTZ, so we better parse as local:
      const dDate = new Date(me.deadline);
      return dDate.getFullYear() === y && dDate.getMonth() === m && dDate.getDate() === d;
    });

    return {
      exams: dayExams,
      mockExams: dayMockExams,
      totalCount: dayExams.length + dayMockExams.length
    };
  };

  const handlePrevMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    setSelectedDayStr(`${y}-${m}-${d}`);
  };

  // Get currently selected day events
  const getSelectedEvents = () => {
    if (!selectedDayStr) return { exams: [], mockExams: [], totalCount: 0 };
    const [y, m, d] = selectedDayStr.split('-').map(Number);
    // Note database dates are YYYY-MM-DD, month is 1-indexed in split
    return getEventsForDate(y, m - 1, d);
  };

  const selectedEvents = getSelectedEvents();
  const hasSelectedEvents = selectedEvents.totalCount > 0;

  return (
    <div className="p-6 md:p-8 rounded-3xl bg-neutral-950/40 border border-neutral-900/80 backdrop-blur-md space-y-6">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-neutral-200 tracking-tight font-display flex items-center gap-2">
              Calendário Acadêmico Visual
            </h3>
            <p className="text-[11px] text-neutral-500 leading-normal">
              Acompanhe as próximas avaliações e simulados virtuais de forma intuitiva.
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleGoToToday}
            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-350 rounded-lg text-[11px] font-bold border border-neutral-800 hover:text-neutral-100 cursor-pointer transition-all active:scale-95"
          >
            Hoje
          </button>
          
          <div className="flex items-center bg-neutral-900/80 rounded-xl border border-neutral-850 p-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-neutral-800 hover:text-neutral-100 text-neutral-500 rounded-lg cursor-pointer transition-all active:scale-90"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-black text-neutral-300 font-mono tracking-tight select-none">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-neutral-800 hover:text-neutral-100 text-neutral-500 rounded-lg cursor-pointer transition-all active:scale-90"
              title="Próximo Mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Calendar Grid - md:col-span-7 */}
        <div className="md:col-span-7 space-y-3">
          {/* Week Days Header */}
          <div className="grid grid-cols-7 text-center gap-1">
            {weekDays.map(day => (
              <span key={day} className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 font-mono py-1 select-none">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {allCalendarDays.map((cell, idx) => {
              const formattedMonth = String(cell.month + 1).padStart(2, '0');
              const formattedDay = String(cell.day).padStart(2, '0');
              const dateStr = `${cell.year}-${formattedMonth}-${formattedDay}`;

              const isSelected = selectedDayStr === dateStr;
              const isToday = (() => {
                const today = new Date();
                return today.getDate() === cell.day && 
                       today.getMonth() === cell.month && 
                       today.getFullYear() === cell.year;
              })();

              const dayEvents = getEventsForDate(cell.year, cell.month, cell.day);

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDayStr(dateStr)}
                  className={`aspect-square min-h-[44px] rounded-xl flex flex-col justify-between p-1.5 border transition-all cursor-pointer relative group/cell ${
                    !cell.isCurrentMonth
                      ? 'text-neutral-700 border-transparent bg-transparent opacity-30 hover:opacity-50'
                      : isSelected
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/35 shadow-inner'
                      : isToday
                      ? 'bg-neutral-900 text-neutral-200 border-neutral-800'
                      : 'bg-neutral-950/30 text-neutral-450 border-neutral-900 hover:bg-neutral-900/40 hover:text-neutral-300'
                  }`}
                >
                  {/* Day Number */}
                  <span className={`text-xs font-bold font-mono self-start ${isToday && !isSelected ? 'text-emerald-400 font-extrabold' : ''}`}>
                    {cell.day}
                  </span>

                  {/* Indicator badges / dots */}
                  {dayEvents.totalCount > 0 && (
                    <div className="flex gap-1 flex-wrap self-end w-full justify-end mt-1">
                      {dayEvents.exams.map((_, i) => (
                        <span 
                          key={`ex-${i}`} 
                          className="h-1.5 w-1.5 rounded-full bg-rose-500 shadow-sm shadow-rose-900 animate-pulse" 
                          title="Avaliação Presencial Marcada"
                        />
                      ))}
                      {dayEvents.mockExams.map((_, i) => (
                        <span 
                          key={`me-${i}`} 
                          className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-900 animate-pulse" 
                          title="Simulado Virtual"
                        />
                      ))}
                    </div>
                  )}

                  {/* Tiny subtle border indicator */}
                  {dayEvents.totalCount > 0 && !isSelected && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-t-full bg-emerald-500/55" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Color Guides / Legenda */}
          <div className="flex items-center gap-4 text-[10px] text-neutral-500 pt-2 font-mono">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 border border-rose-450/40" />
              <span>Avaliação Presencial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-450 border border-emerald-400/40" />
              <span>Simulado Online</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/35" />
              <span>Selecionado</span>
            </div>
          </div>
        </div>

        {/* Selected Day Events - md:col-span-5 */}
        <div className="md:col-span-5 h-full flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDayStr}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="bg-neutral-950/60 p-5 rounded-2xl border border-neutral-900 space-y-4 h-full flex flex-col min-h-[300px]"
            >
              <div>
                <h4 className="text-xs uppercase font-extrabold tracking-wider text-neutral-500 font-mono">
                  Atividades para o dia:
                </h4>
                {selectedDayStr && (
                  <p className="text-neutral-250 font-black text-sm mt-1 font-mono">
                    {(() => {
                      const [y, m, d] = selectedDayStr.split('-').map(Number);
                      const formattedMonth = String(m).padStart(2, '0');
                      const formattedDay = String(d).padStart(2, '0');
                      return `${formattedDay}/${formattedMonth}/${y}`;
                    })()}
                  </p>
                )}
              </div>

              {!hasSelectedEvents ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-neutral-950/20 border border-neutral-900/40 rounded-xl space-y-2">
                  <div className="p-3 bg-neutral-900 rounded-full text-neutral-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h5 className="text-xs font-bold text-neutral-450">Sem atividades programadas</h5>
                  <p className="text-[10px] text-neutral-600 max-w-[190px]">
                    Nenhum simulado ou prova possui data de entrega marcada para este dia.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 flex-1 overflow-y-auto max-h-[280px] pr-1 scrollbar-thin">
                  {/* Display standard physical exams */}
                  {selectedEvents.exams.map((ex, i) => {
                    const dateInfo = formatExamDateDisplay(ex, ex.exam_time);
                    return (
                      <div 
                        key={`list-ex-${i}`}
                        className="p-3.5 bg-rose-500/5 rounded-xl border border-rose-500/10 space-y-2.5"
                      >
                        <div className="flex items-start justify-between min-w-0">
                          <div>
                            <span className="text-[9px] font-bold font-mono text-rose-350 uppercase bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/10 inline-block">
                              {ex.materia || 'Outro'}
                            </span>
                            <h5 className="text-xs font-extrabold text-neutral-200 mt-1.5 leading-snug line-clamp-2">
                              {ex.title}
                            </h5>
                            <p className="text-[10px] text-neutral-500 font-mono mt-1">
                              Professor: {ex.teacher_name}
                            </p>
                          </div>
                        </div>

                        {/* Date and Time Badge */}
                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-rose-300 bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-900/30">
                          <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>{dateInfo.fullFormatted || 'Data marcada'}</span>
                        </div>

                        <div className="text-[10.5px] text-neutral-400 bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-900 leading-normal">
                          <span className="block font-bold text-[9px] uppercase tracking-wider text-neutral-500 mb-0.5">Conteúdo:</span>
                          {cleanExamContent(ex.content)}
                        </div>

                        {cleanExamObservations(ex.observations) && (
                          <div className="text-[10px] text-neutral-400 bg-neutral-950/30 p-2 rounded-lg border border-neutral-900 italic">
                            <span className="block not-italic font-bold text-[8.5px] uppercase tracking-wider text-neutral-500 mb-0.5">Observações:</span>
                            {cleanExamObservations(ex.observations)}
                          </div>
                        )}

                        <button
                          onClick={() => onStudyForExam(ex.title, cleanExamContent(ex.content))}
                          className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-455 text-neutral-950 font-bold rounded-lg text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer select-none"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Gerar Assistente de Estudo AI</span>
                        </button>
                      </div>
                    );
                  })}

                  {/* Display virtual online simulations */}
                  {selectedEvents.mockExams.map((me, i) => {
                    const rawDeadline = me.deadline || me.due_date || me.exam_date;
                    const meDateInfo = rawDeadline ? formatExamDateDisplay(rawDeadline) : null;
                    return (
                      <div 
                        key={`list-mock-${i}`}
                        className="p-3.5 bg-emerald-500/5 rounded-xl border border-emerald-500/10 space-y-2.5"
                      >
                        <div className="flex items-start justify-between min-w-0">
                          <div>
                            <span className="text-[9px] font-bold font-mono text-emerald-350 uppercase bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/10 inline-block">
                              {me.subject || 'Geral'}
                            </span>
                            <h5 className="text-xs font-extrabold text-neutral-200 mt-1.5 leading-snug line-clamp-2">
                              {me.title}
                            </h5>
                            {me.teacher_name && (
                              <p className="text-[10px] text-neutral-500 font-mono mt-1">
                                Professor: {me.teacher_name}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-300 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-900/30">
                          <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>
                            {rawDeadline && meDateInfo?.fullFormatted
                              ? `Prazo: ${meDateInfo.fullFormatted}`
                              : 'Prazo: Sem prazo (ritmo livre)'}
                          </span>
                        </div>

                        {me.description && (
                          <p className="text-[10.5px] text-neutral-400 italic bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-900 leading-normal">
                            "{parseExamSettings(me.description).cleanDescription || "Sem instruções específicas."}"
                          </p>
                        )}

                        <button
                          onClick={onTakeMockExam}
                          className="w-full py-1.5 bg-neutral-900 hover:bg-neutral-850 text-emerald-300 border border-emerald-500/15 hover:border-emerald-500/30 font-bold rounded-lg text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer select-none"
                        >
                          <span>Responder Simulado</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
