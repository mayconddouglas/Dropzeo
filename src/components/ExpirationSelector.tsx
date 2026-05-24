import { ExpirationOption } from '../types.js';

interface ExpirationSelectorProps {
  value: ExpirationOption;
  onChange: (value: ExpirationOption) => void;
}

const options: { label: string; sublabel: string; value: ExpirationOption }[] = [
  { label: '5 min', sublabel: 'Rápido', value: '5min' },
  { label: '15 min', sublabel: 'Padrão', value: '15min' },
  { label: '30 min', sublabel: 'Estendido', value: '30min' },
];

export default function ExpirationSelector({ value, onChange }: ExpirationSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative flex flex-col items-center gap-0.5 py-3 px-2 rounded-xl border transition-all duration-150 cursor-pointer text-center
              ${active
                ? 'border-cyan-400/30 bg-cyan-400/8 text-cyan-400'
                : 'border-white/6 bg-white/[0.02] text-white/40 hover:border-white/12 hover:text-white/60 hover:bg-white/[0.03]'
              }`}
          >
            <span className={`text-sm font-semibold font-mono ${active ? 'text-cyan-400' : ''}`}>{opt.label}</span>
            <span className={`text-[10px] ${active ? 'text-cyan-400/60' : 'text-white/25'}`}>{opt.sublabel}</span>
            {active && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-cyan-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}
