/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ScreenType = 'PORTAL_HOME' | 'LOGIN' | 'STUDENT_DASHBOARD' | 'TEACHER_DASHBOARD' | 'DASHBOARD_EMPTY' | 'ADMIN_PORTAL';
export type PortalRole = 'student' | 'teacher';

export interface SubjectGrade {
  id: string;
  subject: string;
  grade: number;
  maxGrade: number;
  teacher: string;
  status: 'Aprovado' | 'Em Análise' | 'Recuperação';
}

export interface UpcomingClass {
  id: string;
  subject: string;
  time: string;
  room: string;
  professor: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  author: string;
  category: 'Geral' | 'Urgent' | 'Prova' | 'Evento';
}

export interface Task {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  status: 'Pendente' | 'Concluído' | 'Atrasado';
}

export interface MockExamQuestion {
  id: string;
  type: 'multiple' | 'written';
  text: string;
  imageUrl?: string;
  imageUrls?: string[]; // array of base64 images (max 4)
  options?: string[]; // array of choice options, e.g., ["Alt A", "Alt B"]
  correctOption?: number; // index of the correct option for auto-correction (0, 1, 2, 3...)
  explanation?: string;
  points?: number; // value of this question (e.g. 1.0, 0.5, 2.0)
  isEnem?: boolean;
  enemYear?: number;
  originalIndices?: number[];
  correctionType?: 'manual' | 'ai'; // 'manual' or 'ai' correction for written questions
  expectedAnswer?: string; // teacher's reference/expected answer for AI grading
}

export interface MockExam {
  id: string;
  title: string;
  description: string;
  subject: string;
  class_name: string; // cohort target, e.g. "8ºA"
  teacher_id?: string;
  teacher_email: string;
  teacher_name?: string;
  deadline?: string; // ISO timestamp or date
  questions: MockExamQuestion[];
  total_points?: number;
  instructions?: string;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  is_draft?: boolean;
  created_at?: string;
}

export interface MockSubmission {
  id: string;
  mock_exam_id: string;
  student_email: string;
  student_name: string;
  student_class: string;
  answers: Record<string, string | number>; // questionId -> response
  score: number;
  total_questions: number;
  correct_count: number;
  submitted_at: string;
  manual_grades?: Record<string, {
    status: 'correct' | 'half' | 'wrong';
    pointsAwarded: number;
    comment?: string;
    gradedBy?: 'manual' | 'ai';
  }>; // questionId -> manual/AI grading details for written questions
  telemetry?: {
    totalTimeSeconds?: number;
    questionTimes?: Record<string, number>; // questionId -> time in seconds
    optionChanges?: Record<string, number>; // questionId -> number of changes
    tabSwitches?: number; // number of times the user switched away from the tab
    firstInteractionTime?: string;
    is_unfinished?: boolean;
    timeout_submitted?: boolean;
    violation?: boolean;
    violation_submitted?: boolean;
    abandoned?: boolean;
    manual_grades?: Record<string, {
      status: 'correct' | 'half' | 'wrong';
      pointsAwarded: number;
      comment?: string;
      gradedBy?: 'manual' | 'ai';
    }>;
    [key: string]: any;
  };
}

export interface VirtualClass {
  id: string;
  name: string;
  teacher_email: string;
  teacher_id?: string;
  student_emails: string[];
  access_code?: string;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  nome_completo?: string;
  email: string;
  role: string;
  turma?: string;
  numero_chamada?: string | number;
  escola?: string;
}

export type PaperRulingStyle = 'lined' | 'grid' | 'dots' | 'blank';
export type HandwritingFont = 'font-handwriting' | 'font-handwriting-kalam' | 'font-sans-clean';

export interface NotebookStamp {
  id: string;
  type: 'visto' | 'excelente' | 'foco' | 'nota10' | 'revisar' | 'parabens';
  label: string;
  color: string;
  teacherName: string;
  teacherEmail: string;
  date: string;
  comment?: string;
  pageIndex?: number;
}

export interface NotebookPage {
  id: string;
  title?: string;
  content: string;
  date?: string;
  paperStyle?: PaperRulingStyle;
  stamp?: NotebookStamp;
  reviewNotes?: string;
  stampHistory?: NotebookStamp[];
}

export interface StudentNotebook {
  id: string;
  student_email: string;
  student_name: string;
  student_class: string;
  subject: string;
  title: string;
  cover_theme?: string;
  paper_style?: PaperRulingStyle;
  font_style?: HandwritingFont;
  pages: NotebookPage[];
  status: 'draft' | 'pending_review' | 'reviewed';
  requested_teacher_email?: string;
  student_message?: string;
  teacher_feedback?: string;
  last_stamp?: NotebookStamp;
  created_at?: string;
  updated_at: string;
}

export function getUniqueRA(email: string): string {
  if (!email) return "RA2026001";
  const cleanEmail = email.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < cleanEmail.length; i++) {
    hash = cleanEmail.charCodeAt(i) + ((hash << 5) - hash);
  }
  const uniqueCode = Math.abs(hash % 90000) + 10000; // Generates a stable 5-digit number (10000 to 99999)
  return `RA2026${uniqueCode}`;
}

