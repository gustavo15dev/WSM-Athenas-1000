import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const authHeader = req.headers.get('Authorization');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    // 1. Get authenticated user
    let userEmail = '';
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (user && user.email) {
      userEmail = user.email.toLowerCase().trim();
    } else {
      // Fallback: check query parameter or request body if provided
      try {
        const url = new URL(req.url);
        const qEmail = url.searchParams.get('email');
        if (qEmail) {
          userEmail = qEmail.toLowerCase().trim();
        } else if (req.method === 'POST') {
          const body = await req.json().catch(() => ({}));
          if (body.email) userEmail = String(body.email).toLowerCase().trim();
        }
      } catch {
        // ignore
      }
    }

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: User email required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch virtual classes where the student is enrolled
    const { data: allClasses, error: classesError } = await supabase
      .from('wsm_virtual_classes')
      .select('id, name, teacher_email, teacher_id, student_emails');

    if (classesError) {
      return new Response(
        JSON.stringify({ error: classesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter classes containing this student's email
    const studentClasses = (allClasses || []).filter((vc: any) => {
      if (!vc) return false;
      const emailsRaw = vc.student_emails;
      let emails: string[] = [];
      if (Array.isArray(emailsRaw)) {
        emails = emailsRaw.map((e: any) => String(e).toLowerCase().trim());
      } else if (typeof emailsRaw === 'string') {
        try {
          const parsed = JSON.parse(emailsRaw);
          if (Array.isArray(parsed)) emails = parsed.map((e: any) => String(e).toLowerCase().trim());
          else emails = emailsRaw.split(',').map(s => s.toLowerCase().trim());
        } catch {
          emails = emailsRaw.split(',').map(s => s.toLowerCase().trim());
        }
      }
      return emails.includes(userEmail);
    });

    if (!studentClasses || studentClasses.length === 0) {
      // Aluno não está em nenhuma sala — retorna lista vazia imediatamente
      return new Response(
        JSON.stringify([]),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
      );
    }

    // 3. Pegar emails e IDs únicos dos professores dessas salas
    const teacherEmails = [...new Set(
      studentClasses
        .map((c: any) => (c.teacher_email || '').toLowerCase().trim())
        .filter(Boolean)
    )];

    if (teacherEmails.length === 0) {
      return new Response(
        JSON.stringify([]),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
      );
    }

    // 4. Buscar dados DESSES professores na tabela wsm_user_profiles (sem a coluna escola para evitar erro 400)
    const { data: teachers, error: teachersError } = await supabase
      .from('wsm_user_profiles')
      .select('id, email, nome_completo, materia, role, anos_lecionados')
      .in('email', teacherEmails);

    if (teachersError) {
      return new Response(
        JSON.stringify({ error: teachersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const filtered = (teachers || []).filter((t: any) => {
      const em = (t.email || '').toLowerCase().trim();
      return teacherEmails.includes(em) && !em.endsWith('@atenas.com') && !em.endsWith('@example.com');
    });

    return new Response(
      JSON.stringify(filtered),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
