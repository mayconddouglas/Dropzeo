import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

interface CountdownTimerProps {
  expiresAt: string;
  onExpire?: () => void;
  className?: string;
}

export default function CountdownTimer({ expiresAt, onExpire, className }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{ m: number; s: number; expired: boolean }>({ m: 0, s: 0, expired: false });

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ m: 0, s: 0, expired: true });
        onExpire?.();
        return true;
      }
      setTimeLeft({
        m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        s: Math.floor((diff % (1000 * 60)) / 1000),
        expired: false,
      });
      return false;
    };
    if (calculate()) return;
    const timer = setInterval(() => { if (calculate()) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  const fmt = (n: number) => String(n).padStart(2, '0');

  if (timeLeft.expired) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        Expirado
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-white/40 ${className}`}>
      <Timer className="w-3 h-3 text-cyan-400" />
      <span className="font-mono text-white/60">{fmt(timeLeft.m)}:{fmt(timeLeft.s)}</span>
    </span>
  );
}
