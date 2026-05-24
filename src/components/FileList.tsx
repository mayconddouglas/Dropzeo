import { SelectedFile } from '../types.js';
import { formatBytes } from '../lib/utils.js';
import { File, Trash2, Check, AlertCircle, Loader2 } from 'lucide-react';

interface FileListProps {
  files: SelectedFile[];
  onRemoveFile: (id: string) => void;
  isUploading: boolean;
}

export default function FileList({ files, onRemoveFile, isUploading }: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-2 mt-4">
      <h4 className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">
        Arquivos Selecionados ({files.length})
      </h4>
      <div className="max-h-[250px] overflow-y-auto pr-1 space-y-2 divide-y-0 scrollbar-thin">
        {files.map((selected) => {
          return (
            <div
              key={selected.id}
              id={`file-item-${selected.id}`}
              className="flex flex-col gap-2 p-3 bg-[#141414] border border-[#262626] rounded-xl transition-all duration-200"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="p-2 bg-[#0a0a0a] rounded-lg border border-[#262626] text-white">
                    <File className="w-4 h-4 text-[#6366f1]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium text-white truncate" title={selected.name}>
                      {selected.name}
                    </p>
                    <p className="text-[11px] text-[#a3a3a3] mt-0.5">
                      {formatBytes(selected.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status indicators */}
                  {selected.status === 'uploading' && (
                    <span className="flex items-center gap-1.5 text-xs text-[#6366f1]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="hidden sm:inline">Enviando...</span>
                    </span>
                  )}
                  {selected.status === 'completed' && (
                    <span className="p-1 bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 rounded-md">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {selected.status === 'failed' && (
                    <span className="flex items-center gap-1 text-[11px] text-[#ef4444]" title={selected.error}>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Erro</span>
                    </span>
                  )}

                  {/* Trash remover */}
                  {!isUploading && (
                    <button
                      id={`remove-file-btn-${selected.id}`}
                      onClick={() => onRemoveFile(selected.id)}
                      className="text-[#a3a3a3] hover:text-[#ef4444] p-1.5 hover:bg-[#0a0a0a] rounded-lg border border-transparent hover:border-[#262626] transition-all cursor-pointer"
                      title="Remover arquivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {selected.status === 'uploading' && (
                <div className="w-full h-1 bg-[#0a0a0a] rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-[#6366f1] transition-all duration-300"
                    style={{ width: `${selected.progress}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
