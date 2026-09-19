-- =========================================================================
--             ATHENAS PORTAL UNIVERSITÁRIO - RESET E SCHEMA COMPLETO
-- =========================================================================
-- Este script limpa absolutamente tudo do banco (incluindo usuários da auth)
-- e recria toda a estrutura do portal Athenas do zero com 100% de harmonia.
-- =========================================================================

-- -------------------------------------------------------------------------
-- PASSO 1: DESABILITAR TRIGGERS E FAZER A LIMPEZA TOTAL (RESET)
-- -------------------------------------------------------------------------
SET session_replication_role = 'replica';

-- Apaga as tabelas acadêmicas do projeto
DROP TABLE IF EXISTS public.wsm_system_logs CASCADE;
DROP TABLE IF EXISTS public.wsm_chat_messages CASCADE;
DROP TABLE IF EXISTS public.wsm_chat_sessions CASCADE;
DROP TABLE IF EXISTS public.wsm_notifications CASCADE;
DROP TABLE IF EXISTS public.wsm_mock_submissions CASCADE;
DROP TABLE IF EXISTS public.wsm_mock_exams CASCADE;
DROP TABLE IF EXISTS public.wsm_exams CASCADE;
DROP TABLE IF EXISTS public.wsm_announcements CASCADE;
DROP TABLE IF EXISTS public.wsm_virtual_classes CASCADE;
DROP TABLE IF EXISTS public.wsm_student_analytics CASCADE;
DROP TABLE IF EXISTS public.wsm_user_profiles CASCADE;

-- Limpa absolutamente todos os usuários autenticados da tabela auth do Supabase
DELETE FROM auth.users CASCADE;

-- Reestabelece o modo padrão de execução das triggers
SET session_replication_role = 'origin';


-- -------------------------------------------------------------------------
-- PASSO 2: CRIAÇÃO DA TABELA DE PERFIS DE USUÁRIOS (wsm_user_profiles)
-- -------------------------------------------------------------------------
-- Usamos ID primário do tipo UUID para sincronizar perfeitamente tanto com
-- registros manuais de Administrador quanto cadastros diretos da Auth.
CREATE TABLE public.wsm_user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
    nome_completo TEXT NOT NULL,
    turma TEXT,
    numero_chamada INTEGER,
    anos_lecionados TEXT[],             -- Turmas físicas associadas ao docente
    materia TEXT DEFAULT 'Computação', -- Disciplina lecionada pelo docente
    senha_plana TEXT DEFAULT '123456', -- Exibe/edita e realiza login facilitado com a senha real da conta
    notification_gmail TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ativar segurança
ALTER TABLE public.wsm_user_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso irrestrito para facilitar logins, cadastros dinâmicos e consultas rápidas
CREATE POLICY "Acesso total a perfis" 
ON public.wsm_user_profiles FOR ALL 
USING (true) 
WITH CHECK (true);


-- -------------------------------------------------------------------------
-- PASSO 3: CRIAÇÃO DA TABELA DE EXAMES FÍSICOS (wsm_exams)
-- -------------------------------------------------------------------------
CREATE TABLE public.wsm_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    exam_date DATE NOT NULL,
    content TEXT NOT NULL,
    observations TEXT,
    teacher_email TEXT NOT NULL,
    teacher_name TEXT,
    materia TEXT,
    classes TEXT[],                     -- Ex: {'8ºA', '8ºB'} ou emails individuais do aluno
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.wsm_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a exames"
ON public.wsm_exams FOR ALL
USING (true)
WITH CHECK (true);


-- -------------------------------------------------------------------------
-- PASSO 4: CRIAÇÃO DA TABELA DE NOTIFICAÇÕES (wsm_notifications)
-- -------------------------------------------------------------------------
CREATE TABLE public.wsm_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.wsm_user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.wsm_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a notificacoes"
ON public.wsm_notifications FOR ALL
USING (true)
WITH CHECK (true);


-- -------------------------------------------------------------------------
-- PASSO 5: CRIAÇÃO DA TABELA SESSÕES DE CHAT AI (wsm_chat_sessions)
-- -------------------------------------------------------------------------
CREATE TABLE public.wsm_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.wsm_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a sessoes de chat"
ON public.wsm_chat_sessions FOR ALL
USING (true)
WITH CHECK (true);


-- -------------------------------------------------------------------------
-- PASSO 6: CRIAÇÃO DA TABELA MENSAGENS DE CHAT AI (wsm_chat_messages)
-- -------------------------------------------------------------------------
CREATE TABLE public.wsm_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.wsm_chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb, -- Imagens e documentos anexados
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.wsm_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a mensagens de chat"
ON public.wsm_chat_messages FOR ALL
USING (true)
WITH CHECK (true);


-- -------------------------------------------------------------------------
-- PASSO 7: CRIAÇÃO DA TABELA DE TURMAS VIRTUAIS (wsm_virtual_classes)
-- -------------------------------------------------------------------------
CREATE TABLE public.wsm_virtual_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    teacher_email TEXT NOT NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    access_code TEXT UNIQUE NOT NULL,
    student_emails TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.wsm_virtual_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a salas virtuais"
ON public.wsm_virtual_classes FOR ALL
USING (true)
WITH CHECK (true);


-- -------------------------------------------------------------------------
-- PASSO 8: CRIAÇÃO DA TABELA SIMULADOS ONLINE (wsm_mock_exams)
-- -------------------------------------------------------------------------
CREATE TABLE public.wsm_mock_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    subject TEXT,
    class_name TEXT,                    -- Cohort (Ex: '8ºA'), Email ou Id de Turma Virtual
    teacher_email TEXT NOT NULL,
    teacher_name TEXT,
    deadline TIMESTAMPTZ,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    shuffle_questions BOOLEAN NOT NULL DEFAULT false,
    shuffle_options BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.wsm_mock_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a simulados online"
ON public.wsm_mock_exams FOR ALL
USING (true)
WITH CHECK (true);


-- -------------------------------------------------------------------------
-- PASSO 9: CRIAÇÃO DA TABELA DE RESPOSTAS SUBMETIDAS (wsm_mock_submissions)
-- -------------------------------------------------------------------------
CREATE TABLE public.wsm_mock_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mock_exam_id UUID NOT NULL REFERENCES public.wsm_mock_exams(id) ON DELETE CASCADE,
    student_email TEXT NOT NULL,
    student_name TEXT,
    student_class TEXT,
    answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    score NUMERIC(4,2),                 -- Nota (ex: 7.50, 10.00)
    total_questions INTEGER,
    correct_count INTEGER,
    telemetry JSONB DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.wsm_mock_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a submissoes de simulados"
ON public.wsm_mock_submissions FOR ALL
USING (true)
WITH CHECK (true);


-- -------------------------------------------------------------------------
-- PASSO 10: CRIAÇÃO DA TABELA COMUNICADOS ACADÊMICOS (wsm_announcements)
-- -------------------------------------------------------------------------
CREATE TABLE public.wsm_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Geral', -- 'Geral', 'Urgent', 'Prova', 'Evento'
    teacher_email TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    liked_by TEXT[] DEFAULT '{}',        -- E-mails que curtiram o aviso acadêmico
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.wsm_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a comunicados"
ON public.wsm_announcements FOR ALL
USING (true)
WITH CHECK (true);


-- -------------------------------------------------------------------------
-- PASSO 11: CRIAÇÃO DA TABELA AUDITORIA DE SISTEMA (wsm_system_logs)
-- -------------------------------------------------------------------------
CREATE TABLE public.wsm_system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    user_name TEXT,
    role TEXT,
    action TEXT NOT NULL,
    details TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    location_info TEXT,                 -- Registra navegador, navegação e dados de dispositivo
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.wsm_system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a logs do sistema"
ON public.wsm_system_logs FOR ALL
USING (true)
WITH CHECK (true);


-- -------------------------------------------------------------------------
-- PASSO 12: CRIAÇÃO DA TABELA DE ANALYTICS (wsm_student_analytics)
-- -------------------------------------------------------------------------
CREATE TABLE public.wsm_student_analytics (
    student_email TEXT PRIMARY KEY,
    total_time_minutes INT DEFAULT 0,
    monthly_hours JSONB DEFAULT '{}'::jsonb,
    weekly_hours JSONB DEFAULT '{}'::jsonb,
    daily_hours JSONB DEFAULT '{}'::jsonb,
    hourly_distribution JSONB DEFAULT '{}'::jsonb,
    most_active_day TEXT DEFAULT 'Segunda-feira',
    preferred_time_of_day TEXT DEFAULT 'Tarde (13h - 18h)',
    avg_session_duration_minutes INT DEFAULT 0,
    weekly_frequency INT DEFAULT 0,
    consistency_level TEXT DEFAULT 'Normal',
    chat_general_vs_exam_pref TEXT DEFAULT 'Misto',
    study_style_type TEXT DEFAULT 'Espaçado',
    week_to_week_progress JSONB DEFAULT '[]'::jsonb,
    last_exam_theme TEXT,
    last_exam_date TEXT,
    percentile INT DEFAULT 0,
    red_flags TEXT DEFAULT '🟢 Saudável. Sem anomalias.',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.wsm_student_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total a analytics dos estudantes"
ON public.wsm_student_analytics FOR ALL
USING (true)
WITH CHECK (true);


-- -------------------------------------------------------------------------
-- PASSO 13: CRIAÇÃO DOS ÍNDICES DE DESEMPENHO E VELOCIDADE
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_wsm_profiles_email ON public.wsm_user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_wsm_profiles_turma ON public.wsm_user_profiles(turma);
CREATE INDEX IF NOT EXISTS idx_wsm_sessions_user ON public.wsm_chat_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_wsm_messages_session ON public.wsm_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_wsm_notifications_user ON public.wsm_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_wsm_exams_date ON public.wsm_exams(exam_date);
CREATE INDEX IF NOT EXISTS idx_wsm_virtual_classes_code ON public.wsm_virtual_classes(access_code);
CREATE INDEX IF NOT EXISTS idx_wsm_virtual_classes_teacher ON public.wsm_virtual_classes(teacher_email);
CREATE INDEX IF NOT EXISTS idx_wsm_mock_exams_class ON public.wsm_mock_exams(class_name);
CREATE INDEX IF NOT EXISTS idx_wsm_mock_submissions_student ON public.wsm_mock_submissions(student_email);
CREATE INDEX IF NOT EXISTS idx_wsm_mock_submissions_exam ON public.wsm_mock_submissions(mock_exam_id);
CREATE INDEX IF NOT EXISTS idx_announcements_teacher_email ON public.wsm_announcements(teacher_email);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.wsm_announcements(created_at DESC);

-- =========================================================================
--             FIM DO SCRIPT - BANCO 100% LIMPO E RECONFIGURADO!
-- =========================================================================

