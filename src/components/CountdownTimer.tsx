import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  expiresAt: string;
  onExpire?: () => void;
  className?: string;
}

export default function CountdownTimer({ expiresAt, onExpire, className }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{ m: number; s: number; expired: boolean }>({ m: 0, s: 0, expired: false });

  useEffect(() => {
    const calculateTime = () => {
      const difference = new Date(expiresAt).getTime() - Date.now();
      
      if (difference <= 0) {
        setTimeLeft({ m: 0, s: 0, expired: true });
        if (onExpire) {
          onExpire();
        }
        return true; // is expired
      }

      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ m: minutes, s: seconds, expired: false });
      return false; // active
    };

    // Run immediately
    const firstCheck = calculateTime();
    if (firstCheck) return;

    const timer = setInterval(() => {
      const isEnded = calculateTime();
      if (isEnded) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  if (timeLeft.expired) {
    return (
      <div className={`flex items-center gap-1.5 text-xs font-semibold text-[#ef4444] ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
        <span>LINK EXPIRADO</span>
      </div>
    );
  }

  // Format double digits
  const formatNum = (num: number) => String(num).padStart(2, '0');

  return (
    <div id="countdown-timer-display" className={`flex items-center gap-1.5 text-xs text-[#a3a3a3] ${className}`}>
      <Clock className="w-3.5 h-3.5 text-[#6366f1]" />
      <span className="font-mono text-white font-medium text-xs">
        Expira em: <strong className="text-[#6366f1]">{formatNum(timeLeft.m)}m {formatNum(timeLeft.s)}s</strong>
      </span>
    </div>
  );
}
