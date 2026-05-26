import { ExpirationOption } from '../types.js';
import { Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface ExpirationSelectorProps {
  value: ExpirationOption;
  onChange: (value: ExpirationOption) => void;
}

export default function ExpirationSelector({ value, onChange }: ExpirationSelectorProps) {
  const options: { label: string; value: ExpirationOption }[] = [
    { label: '5 Minutos', value: '5min' },
    { label: '15 Minutos', value: '15min' },
    { label: '30 Minutos', value: '30min' },
  ];

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
        <Clock className="w-3.5 h-3.5 text-primary" />
        <span>Expiração do Link</span>
      </label>
      <div className="grid grid-cols-3 gap-2 bg-muted/30 border border-border p-1.5 rounded-2xl relative">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              id={`expiry-btn-${option.value}`}
              onClick={() => onChange(option.value)}
              className={`relative py-2.5 px-3 text-xs md:text-sm font-medium rounded-xl transition-colors duration-200 cursor-pointer ${
                isActive
                  ? 'text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-expiry-pill"
                  className="absolute inset-0 bg-primary rounded-xl"
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
              <span className="relative z-10">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
