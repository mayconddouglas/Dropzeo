import { SelectedFile } from '../types.js';
import { formatBytes } from '../lib/utils.js';
import { File, Trash2, Check, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FileListProps {
  files: SelectedFile[];
  onRemoveFile: (id: string) => void;
  isUploading: boolean;
}

export default function FileList({ files, onRemoveFile, isUploading }: FileListProps) {
  if (files.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 mt-4 font-sans">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Arquivos Selecionados ({files.length})
      </h4>
      <div className="max-h-[250px] overflow-y-auto pr-1 space-y-2 divide-y-0 scrollbar-thin">
        <AnimatePresence>
        {files.map((selected) => {
          return (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, height: 0, margin: 0, padding: 0 }}
              key={selected.id}
              id={`file-item-${selected.id}`}
              className="flex flex-col gap-2 p-3.5 bg-background/50 backdrop-blur-sm border border-border/50 rounded-2xl transition-all duration-300 hover:bg-background"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="p-2 bg-background rounded-lg border border-border text-foreground">
                    <File className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium text-foreground truncate" title={selected.name}>
                      {selected.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatBytes(selected.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status indicators */}
                  {selected.status === 'uploading' && (
                    <span className="flex items-center gap-1.5 text-xs text-primary">
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
                    <span className="flex items-center gap-1 text-[11px] text-destructive" title={selected.error}>
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Erro</span>
                    </span>
                  )}

                  {/* Trash remover */}
                  {!isUploading && selected.status !== 'completed' && (
                    <button
                      id={`remove-file-btn-${selected.id}`}
                      onClick={() => onRemoveFile(selected.id)}
                      className="text-muted-foreground hover:text-destructive p-1.5 hover:bg-background rounded-lg border border-transparent hover:border-border transition-all cursor-pointer"
                      title="Remover arquivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {selected.status === 'uploading' && (
                <div className="w-full h-1 bg-background rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${selected.progress}%` }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
