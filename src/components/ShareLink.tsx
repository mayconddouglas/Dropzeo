import { useState } from 'react';
import { Copy, Check, Share2, CornerDownRight, RotateCcw } from 'lucide-react';
import CountdownTimer from './CountdownTimer.js';
import { motion, AnimatePresence } from 'motion/react';

interface ShareLinkProps {
  token: string;
  expiresAt: string;
  onReset: () => void;
}

export default function ShareLink({ token, expiresAt, onReset }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);
  
  // Compute full URL dynamically based on frontend context
  const shareUrl = `${window.location.origin}/s/${token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} id="share-link-view" className="bg-card/80 backdrop-blur-xl border border-border/40 rounded-3xl p-8 text-center space-y-6 shadow-lg font-sans relative overflow-hidden">
      
      {/* Decorative background blurs */}
      <div className="absolute -top-24 -right-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

      {/* Icon header */}
      <div className="flex flex-col items-center gap-3 relative z-10">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="p-4 bg-primary/10 rounded-full text-primary border border-primary/20">
          <Share2 className="w-8 h-8" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h3 className="text-xl font-extrabold text-foreground tracking-tight">Seu link está pronto!</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Compartilhe a url abaixo com a pessoa que deverá baixar seus arquivos.
          </p>
        </motion.div>
      </div>

      {/* URL Link Box */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-background border border-border rounded-xl p-2.5 flex items-center justify-between gap-3 max-w-md mx-auto relative z-10 shadow-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1 text-left pl-2">
          <CornerDownRight className="w-4 h-4 text-primary shrink-0 opacity-70" />
          <span className="font-mono text-[13px] md:text-sm font-medium text-foreground truncate select-all">
            {shareUrl}
          </span>
        </div>
        <button
          id="copy-link-btn"
          onClick={handleCopy}
          className={`shrink-0 flex items-center gap-1.5 py-2 px-4 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95 ${
            copied
              ? 'bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Copiado</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </motion.div>

      {/* Countdown status */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex justify-center border-t border-border/40 pt-4 max-w-sm mx-auto relative z-10">
        <CountdownTimer expiresAt={expiresAt} />
      </motion.div>

      {/* Reset flow button */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="pt-2 relative z-10">
        <button
          id="new-upload-btn"
          onClick={onReset}
          className="inline-flex items-center gap-2 py-2.5 px-6 bg-transparent hover:bg-muted border border-border/50 text-muted-foreground hover:text-foreground rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer group"
        >
          <RotateCcw className="w-4 h-4 group-hover:-rotate-90 transition-transform duration-300" />
          <span>Nova Transferência</span>
        </button>
      </motion.div>

    </motion.div>
  );
}
