import { X, FileText, FileImage, FileVideo, FileAudio, Archive, FileCode } from 'lucide-react';
import { SelectedFile } from '../types.js';
import { formatBytes } from '../lib/utils.js';

interface FileListProps {
  files: SelectedFile[];
  onRemove: (id: string) => void;
}

function FileIcon({ type }: { type: string }) {
  const cls = "w-4 h-4";
  if (type.startsWith('image/')) return <FileImage className={cls} />;
  if (type.startsWith('video/')) return <FileVideo className={cls} />;
  if (type.startsWith('audio/')) return <FileAudio className={cls} />;
  if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return <Archive className={cls} />;
  if (type.includes('text') || type.includes('json') || type.includes('xml')) return <FileCode className={cls} />;
  return <FileText className={cls} />;
}

function getExt(name: string) {
  return name.split('.').pop()?.toUpperCase() || 'FILE';
}

export default function FileList({ files, onRemove }: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">{files.length} arquivo{files.length > 1 ? 's' : ''} selecionado{files.length > 1 ? 's' : ''}</span>
        <span className="text-[10px] text-white/25">{formatBytes(files.reduce((s, f) => s + f.size, 0))}</span>
      </div>
      {files.map((f) => (
        <div key={f.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.025] border border-white/6 hover:border-white/10 transition-all">
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0 text-white/30">
            <FileIcon type={f.type} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/75 truncate">{f.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-white/25 font-mono">{getExt(f.name)}</span>
              <span className="text-[10px] text-white/20">·</span>
              <span className="text-[10px] text-white/25">{formatBytes(f.size)}</span>
            </div>
          </div>
          <button
            onClick={() => onRemove(f.id)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
