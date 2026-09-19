import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jotwprwbqabeqswiiztq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_wbYsbMiUOvUYtuxSnuA0Jg_nY_egU1L';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req: any, res: any) {
  // CORS configuration for Vercel
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: "Método não permitido. Apenas POST é suportado." });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }

    const { email, token, newPassword } = body || {};
    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: "E-mail, código de verificação e nova senha são obrigatórios." });
    }

    const targetEmail = String(email).trim().toLowerCase();
    const tokenClean = String(token).trim();

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "A nova senha deve ter no mínimo 6 caracteres." });
    }

    // Query recent OTP issuance logs for this user
    const { data: logs, error: logFetchErr } = await supabase
      .from("wsm_system_logs")
      .select("id, metadata, created_at")
      .eq("user_email", targetEmail)
      .eq("action", "PASSWORD_RESET_OTP_ISSUED")
      .order("created_at", { ascending: false })
      .limit(5);

    if (logFetchErr || !logs || logs.length === 0) {
      return res.status(400).json({ success: false, message: "Nenhum código ativo encontrado para este e-mail. Solicite um novo código." });
    }

    const latestValidLog = logs.find((l: any) => {
      const meta = l.metadata || {};
      return !meta.used && meta.otp === tokenClean;
    });

    if (!latestValidLog) {
      return res.status(400).json({ success: false, message: "Código incorreto. Verifique os 6 dígitos recebidos no seu e-mail." });
    }

    const meta = latestValidLog.metadata || {};
    if (meta.expires_at && Date.now() > meta.expires_at) {
      return res.status(400).json({ success: false, message: "Este código expirou (limite de 15 minutos). Solicite um novo código." });
    }

    // Invalidate the token (mark as used)
    try {
      await supabase
        .from("wsm_system_logs")
        .update({
          metadata: {
            ...meta,
            used: true,
            used_at: new Date().toISOString(),
          },
        })
        .eq("id", latestValidLog.id);
    } catch {
      // ignore
    }

    // Update password in wsm_user_profiles
    try {
      await supabase
        .from("wsm_user_profiles")
        .update({ senha_plana: newPassword })
        .ilike("email", targetEmail);
    } catch (profileErr) {
      console.warn("[Vercel Password Reset] Erro ao atualizar senha no perfil:", profileErr);
    }

    // Audit log
    try {
      await supabase.from("wsm_system_logs").insert([
        {
          user_email: targetEmail,
          user_name: "Usuário",
          role: "user",
          action: "PASSWORD_RESET_COMPLETED",
          details: "Senha redefinida com sucesso com token de uso único (OTP) validado via e-mail.",
          metadata: { method: "email_otp_verified", success: true },
        },
      ]);
    } catch {
      // ignore
    }

    return res.status(200).json({
      success: true,
      message: "Senha redefinida com sucesso!",
    });
  } catch (err: any) {
    console.error("[Vercel Password Reset] Erro no reset-password:", err);
    return res.status(500).json({ success: false, message: "Erro ao processar redefinição da senha." });
  }
}
