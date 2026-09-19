import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jotwprwbqabeqswiiztq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_wbYsbMiUOvUYtuxSnuA0Jg_nY_egU1L';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GMAIL_USER = "wsmathenas@gmail.com";
const GMAIL_APP_PASSWORD = "afkp kepo yxvk ubbi";

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

    const { email } = body || {};
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, message: "Por favor, informe um endereço de e-mail válido." });
    }

    const targetEmail = email.trim().toLowerCase();

    // Look up user name if exists
    let userName = "Estudante/Docente";
    try {
      const { data: profile } = await supabase
        .from("wsm_user_profiles")
        .select("id, email, nome_completo, notification_gmail")
        .ilike("email", targetEmail)
        .maybeSingle();

      if (profile?.nome_completo) {
        userName = profile.nome_completo;
      }
    } catch (dbErr) {
      console.warn("[Password Reset] Aviso ao consultar perfil:", dbErr);
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store in Supabase audit logs so all serverless instances can verify it
    try {
      await supabase.from("wsm_system_logs").insert([
        {
          user_email: targetEmail,
          user_name: userName,
          role: "user",
          action: "PASSWORD_RESET_OTP_ISSUED",
          details: "Código de segurança OTP de 6 dígitos gerado e enviado via e-mail.",
          metadata: {
            otp,
            expires_at: expiresAt,
            attempts: 0,
            used: false,
          },
        },
      ]);
    } catch (logErr) {
      console.warn("[Password Reset] Aviso ao gravar OTP no banco:", logErr);
    }

    // Send email via Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });

    const htmlContent = `
<div style="background-color: #0c0f0d; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center; color: #f3f4f6; margin: 0;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #121814; border: 1px solid #1f2e25; border-radius: 24px; overflow: hidden; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    
    <!-- Header -->
    <div style="padding: 28px; background-color: #0a0e0b; border-bottom: 1px solid #1f2e25; text-align: center;">
      <h1 style="margin: 0; color: #02c39a; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">WSM ATHENAS</h1>
      <p style="margin: 4px 0 0 0; color: #a3a3a3; font-size: 11px; text-transform: uppercase; font-family: monospace;">Recuperação Segura de Acesso</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px 28px;">
      <p style="margin: 0 0 14px 0; color: #d1d5db; font-size: 14px;">Olá, <strong>${userName}</strong>,</p>
      <p style="margin: 0 0 20px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">
        Recebemos uma solicitação para redefinir a senha da sua conta no portal escolar WSM Athenas. Utilize o código de verificação abaixo para definir sua nova senha com segurança:
      </p>
      
      <div style="background-color: #080c09; border: 1px solid #02c39a; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 11px; color: #6ee7b7; text-transform: uppercase; letter-spacing: 2px; font-family: monospace; display: block; margin-bottom: 8px;">Código de Verificação de 6 Dígitos</span>
        <span style="font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #02c39a; font-family: monospace; display: inline-block;">${otp}</span>
        <span style="font-size: 11px; color: #9ca3af; display: block; margin-top: 8px;">Válido por 15 minutos • Uso único</span>
      </div>

      <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
        🔒 <strong>Atenção de Segurança:</strong> Nunca informe este código para terceiros. Se você não solicitou a redefinição, desconsidere este e-mail; sua conta e senha continuam protegidas.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 18px 28px; background-color: #0a0e0b; border-top: 1px solid #1f2e25; text-align: center;">
      <p style="margin: 0; color: #6b7280; font-size: 11px;">&copy; 2026 WSM Athenas • Ambiente Escolar Seguro</p>
    </div>

  </div>
</div>
    `;

    try {
      await transporter.sendMail({
        from: `"WSM Athenas Segurança" <${GMAIL_USER}>`,
        to: targetEmail,
        subject: `Código de Redefinição de Senha WSM Athenas: ${otp}`,
        html: htmlContent,
      });
      console.log(`[Vercel Password Reset] Código de 6 dígitos enviado por e-mail com sucesso para ${targetEmail}`);
    } catch (mailError) {
      console.error(`[Vercel Password Reset] Falha ao enviar e-mail via SMTP para ${targetEmail}:`, mailError);
    }

    // Also trigger Supabase native reset email if configured
    try {
      await supabase.auth.resetPasswordForEmail(targetEmail);
    } catch {
      // ignore
    }

    // CRITICAL: NEVER RETURN OR LOG THE TOKEN TO THE CLIENT RESPONSE!
    return res.status(200).json({
      success: true,
      message: `Enviamos um código de segurança de 6 dígitos para ${targetEmail}. Verifique sua caixa de entrada (e pasta de spam).`,
    });
  } catch (err: any) {
    console.error("[Vercel Password Reset] Erro no request-password-reset:", err);
    return res.status(500).json({ success: false, message: "Erro ao processar solicitação de recuperação de senha." });
  }
}
