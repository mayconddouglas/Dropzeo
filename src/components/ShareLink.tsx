import { useState } from 'react';
import { Copy, Check, ArrowUpRight, RotateCcw, Link2 } from 'lucide-react';
import CountdownTimer from './CountdownTimer.js';

interface ShareLinkProps {
  token: string;
  expiresAt: string;
  onReset: () => void;
}

export default function ShareLink({ token, expiresAt, onReset }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/s/${token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Success header */}
      <div className="flex items-center gap-4 p-5 rounded-2xl bg-cyan-400/5 border border-cyan-400/15">
        <div className="w-12 h-12 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0 animate-pulse-ring">
          <Link2 className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/90">Link gerado com sucesso</p>
          <p className="text-xs text-white/40 mt-0.5">Compartilhe com quem desejar · expira automaticamente</p>
        </div>
        <CountdownTimer expiresAt={expiresAt} className="ml-auto shrink-0" />
      </div>

      {/* URL box */}
      <div className="rounded-xl bg-white/[0.03] border border-white/8 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6">
          <span className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">URL de compartilhamento</span>
        </div>
        <div className="flex items-center gap-2 p-3">
          <p className="flex-1 font-mono text-xs text-cyan-400/80 truncate px-1 select-all">{shareUrl}</p>
          <button
            onClick={handleCopy}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer
              ${copied
                ? 'bg-green-500/15 border border-green-500/25 text-green-400'
                : 'bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/8'
              }`}
          >
            {copied ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/8 transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-3 h-3" /> Abrir
          </a>
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={onReset}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-white/35 hover:text-white/60 border border-white/6 hover:border-white/12 hover:bg-white/[0.02] transition-all cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Nova transferência
      </button>
    </div>
  );
}
