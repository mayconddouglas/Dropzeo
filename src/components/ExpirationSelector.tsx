import { ExpirationOption } from '../types.js';
import { Clock } from 'lucide-react';

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
      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-primary" />
        <span>Tempo de expiração dos arquivos</span>
      </label>
      <div className="grid grid-cols-3 gap-2 bg-background border border-border p-1 rounded-xl">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              id={`expiry-btn-${option.value}`}
              onClick={() => onChange(option.value)}
              className={`py-2 px-3 text-xs md:text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
