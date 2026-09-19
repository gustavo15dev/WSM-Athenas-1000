import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

export default function FullscreenImageViewer() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    const handleOpenImage = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setImageUrl(customEvent.detail);
        setZoom(false); // Reset zoom on new image
      }
    };

    window.addEventListener('wsm-open-image-fullscreen', handleOpenImage);
    return () => {
      window.removeEventListener('wsm-open-image-fullscreen', handleOpenImage);
    };
  }, []);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setImageUrl(null);
      }
    };

    if (imageUrl) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [imageUrl]);

  return (
    <AnimatePresence>
      {imageUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm select-none"
          onClick={() => setImageUrl(null)}
        >
          {/* Top Bar controls */}
          <div 
            className="absolute top-4 right-4 flex items-center gap-2 z-[10000]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoom(!zoom)}
              className="p-2.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-full border border-neutral-800/80 transition-colors cursor-pointer flex items-center justify-center"
              title={zoom ? "Ajustar à tela" : "Dar zoom"}
            >
              {zoom ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setImageUrl(null)}
              className="p-2.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-full border border-neutral-800/80 transition-colors cursor-pointer flex items-center justify-center"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Image Container */}
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`relative max-w-full max-h-full flex items-center justify-center transition-all duration-300 ${
              zoom ? 'overflow-auto cursor-zoom-out p-12' : 'cursor-zoom-in'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (zoom) {
                setZoom(false);
              } else {
                setZoom(true);
              }
            }}
          >
            <img
              src={imageUrl}
              alt="Visualização em tela cheia"
              className={`max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-neutral-800/50 transition-transform duration-300 ${
                zoom ? 'scale-125 md:scale-150' : 'scale-100'
              }`}
              referrerPolicy="no-referrer"
              draggable={false}
            />
          </motion.div>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-neutral-550 text-[11px] font-mono pointer-events-none">
            Clique na imagem para aproximar/afastar • Esc para fechar
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
