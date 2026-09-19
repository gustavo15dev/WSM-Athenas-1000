import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
  value: string; // expects YYYY-MM-DD
  onChange: (value: string) => void;
}

export function CustomDatePicker({ value, onChange }: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const parseValue = () => {
    if (!value) return new Date();
    try {
      // support both YYYY-MM-DD and potentially ISO/datetime-local strings gracefully
      const datePart = value.includes('T') ? value.split('T')[0] : value;
      const [y, m, d] = datePart.split('-').map(Number);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date();
      return new Date(y, m - 1, d);
    } catch {
      return new Date();
    }
  };

  const initialDate = parseValue();
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(value ? initialDate : null);

  // Sync state if value prop changes externally
  useEffect(() => {
    if (value) {
      const parsed = parseValue();
      setSelectedDate(parsed);
      setCurrentMonth(parsed.getMonth());
      setCurrentYear(parsed.getFullYear());
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const handleDateClick = (day: number) => {
    const newDate = new Date(currentYear, currentMonth, day);
    setSelectedDate(newDate);
    
    // Format to YYYY-MM-DD
    const y = newDate.getFullYear();
    const m = String(newDate.getMonth() + 1).padStart(2, '0');
    const d = String(newDate.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const formatDisplay = () => {
    if (!value) return 'Selecione uma data';
    if (selectedDate) {
      return `${String(selectedDate.getDate()).padStart(2, '0')}/${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${selectedDate.getFullYear()}`;
    }
    return value;
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 bg-neutral-955 border border-neutral-850 hover:border-emerald-500/30 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/35 rounded-xl text-xs text-neutral-200 cursor-pointer transition-all flex items-center justify-between shadow-sm select-none"
      >
        <span className={!value ? "text-neutral-500" : "text-neutral-200 font-medium"}>{formatDisplay()}</span>
        <CalendarIcon className="w-4 h-4 text-emerald-500/70" />
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-neutral-950 border border-neutral-800 rounded-2xl p-4 shadow-2xl z-50 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <button 
              type="button"
              onClick={() => {
                if (currentMonth === 0) {
                  setCurrentMonth(11);
                  setCurrentYear(y => y - 1);
                } else {
                  setCurrentMonth(m => m - 1);
                }
              }}
              className="p-1 hover:bg-neutral-900 rounded-lg text-neutral-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-neutral-200 font-mono">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button 
              type="button"
              onClick={() => {
                if (currentMonth === 11) {
                  setCurrentMonth(0);
                  setCurrentYear(y => y + 1);
                } else {
                  setCurrentMonth(m => m + 1);
                }
              }}
              className="p-1 hover:bg-neutral-900 rounded-lg text-neutral-400 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-[10px] font-bold text-neutral-500 text-center py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = selectedDate && 
                selectedDate.getDate() === day && 
                selectedDate.getMonth() === currentMonth && 
                selectedDate.getFullYear() === currentYear;
              const isToday = new Date().getDate() === day && 
                new Date().getMonth() === currentMonth && 
                new Date().getFullYear() === currentYear;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateClick(day)}
                  className={`h-8 text-xs rounded-lg flex items-center justify-center transition-all ${
                    isSelected 
                      ? 'bg-emerald-500 text-neutral-950 font-bold' 
                      : isToday
                        ? 'border border-emerald-500/30 text-emerald-400 font-semibold hover:bg-emerald-500/10'
                        : 'text-neutral-300 hover:bg-neutral-900'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
