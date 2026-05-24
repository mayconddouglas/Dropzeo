import { useState } from 'react';
import { Copy, Check, Share2, CornerDownRight, RotateCcw } from 'lucide-react';
import CountdownTimer from './CountdownTimer.js';

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
    <div id="share-link-view" className="bg-[#141414] border border-[#262626] rounded-2xl p-6 text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Icon header */}
      <div className="flex flex-col items-center gap-3">
        <div className="p-4 bg-[#6366f1]/10 rounded-full text-[#6366f1] border border-[#6366f1]/20">
          <Share2 className="w-8 h-8 animate-pulse" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Seu link está pronto!</h3>
          <p className="text-xs text-[#a3a3a3] mt-1">
            Qualquer pessoa com acesso a este link poderá baixar seus arquivos.
          </p>
        </div>
      </div>

      {/* URL Link Box */}
      <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-3 flex items-center justify-between gap-3 max-w-md mx-auto">
        <div className="flex items-center gap-2 min-w-0 flex-1 text-left pl-1">
          <CornerDownRight className="w-4 h-4 text-[#6366f1] shrink-0" />
          <span className="font-mono text-xs md:text-sm text-white truncate select-all">
            {shareUrl}
          </span>
        </div>
        <button
          id="copy-link-btn"
          onClick={handleCopy}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            copied
              ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30'
              : 'bg-[#6366f1] hover:bg-[#4f46e5] text-white'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>

      {/* Countdown status */}
      <div className="flex justify-center border-t border-[#262626]/60 pt-4 max-w-sm mx-auto">
        <CountdownTimer expiresAt={expiresAt} />
      </div>

      {/* Reset flow button */}
      <div className="pt-2">
        <button
          id="new-upload-btn"
          onClick={onReset}
          className="inline-flex items-center gap-2 py-2.5 px-5 bg-[#141414] hover:bg-[#202020] border border-[#262626] text-white hover:text-white rounded-xl text-xs md:text-sm font-medium transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-[#a3a3a3]" />
          <span>Novo Upload</span>
        </button>
      </div>

    </div>
  );
}
