import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jotwprwbqabeqswiiztq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_wbYsbMiUOvUYtuxSnuA0Jg_nY_egU1L';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GMAIL_USER = "wsmathenas@gmail.com";
const GMAIL_APP_PASSWORD = "afkp kepo yxvk ubbi";

export default async function handler(req: any, res: any) {
  // CORS configuration
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
    return res.status(405).json({ success: false, message: "Método não permitido." });
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

    const { notifications } = body || {};
    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({ success: false, message: "Lista de notificações inválida ou vazia." });
    }

    const userIds = notifications.map(n => n.user_id).filter(Boolean);
    if (userIds.length === 0) {
      return res.json({ success: true, message: "Nenhum user_id válido fornecido." });
    }

    let profiles: any[] | null = null;
    try {
      const { data } = await supabase
        .from("wsm_user_profiles")
        .select("id, email, nome_completo, notification_gmail")
        .in("id", userIds);
      profiles = data;
    } catch {
      // ignore
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });

    let emailsSent = 0;
    for (const notif of notifications) {
      const profile = profiles?.find((p: any) => p.id === notif.user_id);
      const targetEmail = profile?.notification_gmail || profile?.email;
      if (!targetEmail || !targetEmail.includes("@")) continue;

      const studentName = profile?.nome_completo || "Estudante";
      const htmlContent = `
<div style="background-color: #0c0f0d; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; text-align: center; color: #f3f4f6; margin: 0;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #121814; border: 1px solid #1f2e25; border-radius: 20px; overflow: hidden; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
    <div style="padding: 24px; background-color: #0a0e0b; border-bottom: 1px solid #1f2e25; text-align: center;">
      <h1 style="margin: 0; color: #02c39a; font-size: 20px; font-weight: 800;">WSM ATHENAS</h1>
      <p style="margin: 4px 0 0 0; color: #a3a3a3; font-size: 11px; text-transform: uppercase;">Notificação Escolar</p>
    </div>
    <div style="padding: 28px 24px;">
      <p style="margin: 0 0 12px 0; color: #d1d5db; font-size: 14px;">Olá, <strong>${studentName}</strong>,</p>
      <h2 style="color: #ffffff; font-size: 16px; margin: 0 0 12px 0;">${notif.title}</h2>
      <div style="background-color: #0a0e0b; border-left: 3px solid #02c39a; padding: 14px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.5; white-space: pre-line;">${notif.message}</p>
      </div>
    </div>
    <div style="padding: 16px 24px; background-color: #0a0e0b; border-top: 1px solid #1f2e25; text-align: center;">
      <p style="margin: 0; color: #6b7280; font-size: 11px;">&copy; 2026 WSM Athenas • Ambiente Escolar Seguro</p>
    </div>
  </div>
</div>`;

      try {
        await transporter.sendMail({
          from: `"WSM Athenas" <${GMAIL_USER}>`,
          to: targetEmail,
          subject: `Notificação Escolar: ${notif.title}`,
          html: htmlContent,
        });
        emailsSent++;
      } catch (e) {
        console.error("Erro ao enviar email:", e);
      }
    }

    return res.json({ success: true, count: emailsSent });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
