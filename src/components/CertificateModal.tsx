import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Download, Mail, Crown, Medal, CheckCircle2 } from 'lucide-react';
import { StudentCertificateItem } from '../utils/weeklyRanking';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: StudentCertificateItem | null;
  userEmail?: string;
}

const MASCOT_LOGO_URL = 'https://res.cloudinary.com/dqx8p8orf/image/upload/f_auto/q_auto/gallery_image_20260927_114822-sem-mexer-em-mais-nada-nesse-boneco-mantenha-a-con-removebg-preview_3_ewaz6x.png';

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
};

export default function CertificateModal({ isOpen, onClose, certificate, userEmail }: CertificateModalProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  if (!isOpen || !certificate) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 3000);
  };

  const isGold = certificate.place === 'gold';
  const isSilver = certificate.place === 'silver';

  const metalColor = isGold ? '#e4bf74' : isSilver ? '#c0c0c0' : '#cd7f32';
  const metalBg = isGold ? '#332716' : isSilver ? '#1d272f' : '#2d1e17';
  const categoryTitle = isGold
    ? '1º Lugar — Medalha de Ouro'
    : isSilver
    ? '2º Lugar — Medalha de Prata'
    : '3º Lugar — Medalha de Bronze';

  /**
   * Render high-resolution PNG image (2000 x 1414 px) directly onto Canvas
   */
  const handleDownloadPNG = async () => {
    setIsDownloading(true);
    try {
      // Preload mascot logo image
      let logoImg: HTMLImageElement | null = null;
      try {
        logoImg = await loadImage(MASCOT_LOGO_URL);
      } catch (e) {
        console.warn('Could not load mascot logo for canvas export:', e);
      }

      const canvas = document.createElement('canvas');
      canvas.width = 2000;
      canvas.height = 1414;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        showToast('Erro ao inicializar Canvas para o certificado.');
        setIsDownloading(false);
        return;
      }

      const W = canvas.width;
      const H = canvas.height;

      // 1. Dark Luxury Background
      ctx.fillStyle = '#101613';
      ctx.fillRect(0, 0, W, H);

      // Radial background glow in center
      const gradient = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W / 1.5);
      gradient.addColorStop(0, '#17241e');
      gradient.addColorStop(1, '#0c100e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // 2. Metallic Borders
      // Outer border
      ctx.strokeStyle = metalColor;
      ctx.lineWidth = 8;
      ctx.strokeRect(30, 30, W - 60, H - 60);

      // Inner thin border
      ctx.strokeStyle = metalColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(45, 45, W - 90, H - 90);

      // Subdued dashed inner border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(60, 60, W - 120, H - 120);

      // Corner Accents
      const drawCorner = (x: number, y: number) => {
        ctx.fillStyle = metalColor;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
      };
      drawCorner(45, 45);
      drawCorner(W - 45, 45);
      drawCorner(45, H - 45);
      drawCorner(W - 45, H - 45);

      // 3. Header Logo & Brand
      if (logoImg) {
        const logoSize = 110;
        ctx.drawImage(logoImg, W / 2 - logoSize / 2, 75, logoSize, logoSize);
      } else {
        ctx.fillStyle = metalColor;
        ctx.beginPath();
        ctx.arc(W / 2, 130, 35, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0b0f0e';
        ctx.font = 'bold 38px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('A', W / 2, 130);
      }

      // Brand Name
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = metalColor;
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillText('WSM ATHENAS', W / 2, 210);

      ctx.fillStyle = '#a5b0aa';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText('PLATAFORMA EDUCACIONAL', W / 2, 235);

      // 4. Main Heading
      ctx.fillStyle = '#f1f5f3';
      ctx.font = 'bold 64px Inter, sans-serif';
      ctx.fillText('CERTIFICADO', W / 2, 320);

      ctx.fillStyle = '#77827c';
      ctx.font = '16px Inter, sans-serif';
      ctx.fillText('RECONHECIMENTO ACADÊMICO OFICIAL', W / 2, 360);

      // Category Pill
      ctx.fillStyle = metalBg;
      ctx.beginPath();
      ctx.roundRect(W / 2 - 200, 395, 400, 48, 24);
      ctx.fill();
      ctx.strokeStyle = metalColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = metalColor;
      ctx.font = 'bold 20px Inter, sans-serif';
      ctx.fillText(categoryTitle.toUpperCase(), W / 2, 426);

      // 5. Awarded to text
      ctx.fillStyle = '#a5b0aa';
      ctx.font = '18px Inter, sans-serif';
      ctx.fillText('Conferido com honras ao estudante', W / 2, 510);

      // Student Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px Inter, sans-serif';
      ctx.fillText(certificate.studentName, W / 2, 580);

      // Underline for Student Name
      const nameWidth = ctx.measureText(certificate.studentName).width;
      ctx.strokeStyle = metalColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(W / 2 - Math.max(300, nameWidth / 2), 610);
      ctx.lineTo(W / 2 + Math.max(300, nameWidth / 2), 610);
      ctx.stroke();

      // Certificate Copy
      ctx.fillStyle = '#d1dcd6';
      ctx.font = '22px Inter, sans-serif';
      const line1 = `Por ter alcançado excelente desempenho acadêmico e elevado rigor nos estudos, conquistando a`;
      const line2 = `classificação de destaque no Ranking Semanal da Plataforma Educacional WSM Athenas.`;
      const line3 = `${certificate.cycleRangeText} · ${certificate.weeklyXp.toLocaleString('pt-BR')} XP Acumulados`;

      ctx.fillText(line1, W / 2, 690);
      ctx.fillText(line2, W / 2, 730);

      ctx.fillStyle = metalColor;
      ctx.font = 'bold 22px Inter, sans-serif';
      ctx.fillText(line3, W / 2, 780);

      // 6. Bottom Signatures & Seal
      // Left: Metadata & Auth
      ctx.textAlign = 'left';
      ctx.fillStyle = '#77827c';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText('WSM ATHENAS PLATAFORMA EDUCACIONAL', 120, 1220);
      ctx.fillText(`Data de Emissão: ${certificate.issueDateFormatted}`, 120, 1245);
      ctx.fillText(`Código de Autenticidade: ${certificate.authCode}`, 120, 1270);

      // Center: Official Stamp Seal
      ctx.textAlign = 'center';
      ctx.strokeStyle = metalColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(W / 2, 1220, 65, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = metalColor;
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText('SELO OFICIAL', W / 2, 1195);
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillText('WSM ATHENAS', W / 2, 1220);
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText('RECONHECIMENTO', W / 2, 1242);

      // Right: Signature
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'italic 28px Georgia, serif';
      ctx.fillText('Luiz Gustavo Gomes Miranda', W - 320, 1200);

      ctx.strokeStyle = metalColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W - 500, 1220);
      ctx.lineTo(W - 140, 1220);
      ctx.stroke();

      ctx.fillStyle = '#f1f5f3';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillText('Luiz Gustavo Gomes Miranda', W - 320, 1245);

      ctx.fillStyle = '#77827c';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText('Fundador do WSM Athenas', W - 320, 1270);

      // Convert Canvas to PNG Blob and Download
      canvas.toBlob((blob) => {
        if (!blob) {
          showToast('Erro ao gerar arquivo PNG.');
          setIsDownloading(false);
          return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = certificate.studentName.replace(/[^a-zA-Z0-9]/g, '_');
        a.download = `Certificado_WSM_Athenas_${cleanName}_${certificate.place.toUpperCase()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Certificado em formato PNG baixado com sucesso!');
        setIsDownloading(false);
      }, 'image/png');

    } catch (err) {
      console.error('Error generating certificate PNG:', err);
      showToast('Falha ao exportar certificado em PNG.');
      setIsDownloading(false);
    }
  };

  const handleSendGmail = () => {
    const subject = encodeURIComponent(`🏆 Seu Certificado WSM Athenas - ${categoryTitle}`);
    const body = encodeURIComponent(
      `Olá ${certificate.studentName},\n\n` +
      `Parabéns por conquistar o ${categoryTitle} no Ranking Semanal da WSM Athenas!\n\n` +
      `Período: ${certificate.cycleRangeText}\n` +
      `XP Semanal: ${certificate.weeklyXp.toLocaleString('pt-BR')} XP\n` +
      `Código de Autenticidade: ${certificate.authCode}\n\n` +
      `Você pode visualizar e baixar a versão oficial em imagem PNG acessando a plataforma WSM Athenas.\n\n` +
      `Atenciosamente,\n` +
      `Luiz Gustavo Gomes Miranda - Fundador do WSM Athenas`
    );

    const emailTo = userEmail || certificate.studentEmail || '';
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailTo)}&su=${subject}&body=${body}`, '_blank');
    showToast('Envio por Gmail iniciado em nova aba!');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 font-sans select-text overflow-hidden">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#171e1b] border border-[#27322d] text-[#f1f5f3] px-4 py-3 rounded-xl text-xs shadow-2xl z-50 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#55e6b5]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-3xl bg-[#101613] border-2 border-[#27322d] rounded-2xl p-4 sm:p-6 flex flex-col max-h-[92vh] relative shadow-2xl overflow-hidden"
        style={{ borderColor: metalColor }}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 text-[#77827c] hover:text-[#f1f5f3] bg-[#171e1b] border border-[#27322d] p-2 rounded-xl cursor-pointer transition-all z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#27322d] pb-3 mb-3 pr-8 sm:pr-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-md shrink-0" style={{ backgroundColor: metalBg, borderColor: `${metalColor}60`, color: metalColor }}>
              {isGold ? <Crown className="w-5 h-5" /> : <Medal className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#55e6b5]">
                RECONHECIMENTO ACADÊMICO
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-[#f1f5f3]">
                Certificado Oficial — {categoryTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#a5b0aa] bg-[#171e1b] px-2.5 py-1 rounded-lg border border-[#27322d]">
              {certificate.cycleRangeText}
            </span>
          </div>
        </div>

        {/* PREVIEW CONTAINER (SCROLLABLE IF NEEDED) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#0c100e] border border-[#27322d] rounded-2xl relative flex flex-col items-center text-center space-y-4 shadow-xl">
          
          {/* Decorative Corner Accents */}
          <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: metalColor }} />
          <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: metalColor }} />
          <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2" style={{ borderColor: metalColor }} />
          <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: metalColor }} />

          {/* Official Mascot Logo Header */}
          <div className="flex items-center gap-3">
            <img 
              src={MASCOT_LOGO_URL} 
              alt="WSM Athenas Logo" 
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-md"
            />
            <div className="text-left">
              <div className="text-sm font-black tracking-widest text-[#f1f5f3]">WSM ATHENAS</div>
              <div className="text-[9px] font-mono text-[#77827c]">PLATAFORMA EDUCACIONAL</div>
            </div>
          </div>

          {/* Title */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#a5b0aa]">
              CERTIFICADO DE RECONHECIMENTO ACADÊMICO
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-[#f1f5f3] tracking-tight mt-0.5">
              Certificado
            </h3>
            <div className="inline-block mt-1.5 px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest border" style={{ backgroundColor: metalBg, color: metalColor, borderColor: metalColor }}>
              {categoryTitle}
            </div>
          </div>

          {/* Awardee */}
          <div className="space-y-0.5 max-w-xl w-full">
            <div className="text-xs text-[#a5b0aa]">Conferido oficialmente a</div>
            <div className="text-xl sm:text-2xl font-extrabold text-[#ffffff] border-b pb-1.5 tracking-wide" style={{ borderColor: `${metalColor}80` }}>
              {certificate.studentName}
            </div>
          </div>

          {/* Copy */}
          <p className="text-xs sm:text-sm text-[#c0c9c4] leading-relaxed max-w-xl font-sans">
            Por ter demonstrado extraordinário desempenho acadêmico e constância nos estudos, conquistando a posição de destaque no <strong style={{ color: metalColor }}>Ranking Semanal da Plataforma WSM Athenas</strong> com <strong className="text-[#ffffff] font-mono">{certificate.weeklyXp.toLocaleString('pt-BR')} XP</strong> no período de {certificate.cycleRangeText}.
          </p>

          {/* Footer Details & Signatures */}
          <div className="w-full pt-3 border-t border-[#27322d] grid grid-cols-1 sm:grid-cols-3 items-end gap-3 text-left">
            <div className="text-[9px] sm:text-[10px] text-[#77827c] space-y-0.5">
              <div>WSM Athenas Plataforma Educacional</div>
              <div>Data: {certificate.issueDateFormatted}</div>
              <div className="font-mono text-[9px] text-[#a5b0aa]">{certificate.authCode}</div>
            </div>

            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center text-center p-1" style={{ borderColor: metalColor, color: metalColor }}>
                <span className="text-[6px] font-black uppercase">WSM ATHENAS</span>
                <span className="text-[5px] font-mono">SELO OFICIAL</span>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <div className="text-sm font-serif italic text-[#ffffff]">Luiz Gustavo Gomes Miranda</div>
              <div className="border-t pt-0.5 mt-0.5 text-[10px] text-[#a5b0aa]" style={{ borderColor: `${metalColor}60` }}>
                <strong className="text-[#f1f5f3] block">Luiz Gustavo Gomes Miranda</strong>
                Fundador do WSM Athenas
              </div>
            </div>
          </div>

        </div>

        {/* ACTIONS BAR */}
        <div className="shrink-0 pt-3 mt-1 border-t border-[#27322d] flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="text-[11px] text-[#77827c] text-center sm:text-left">
            Gerado em alta definição (<strong className="text-[#55e6b5]">2000x1414 PNG</strong>) pronto para baixar e compartilhar.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={handleSendGmail}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-[#171e1b] border border-[#27322d] hover:border-[#55e6b5] text-[#f1f5f3] text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-4 h-4 text-[#55e6b5]" />
              <span>Enviar por Gmail</span>
            </button>

            <button
              onClick={handleDownloadPNG}
              disabled={isDownloading}
              className="flex-1 sm:flex-none px-4 py-2 bg-[#55e6b5] hover:bg-[#42d4a3] text-[#0b0f0e] font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Gerando PNG...' : 'Baixar Certificado em PNG'}</span>
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
