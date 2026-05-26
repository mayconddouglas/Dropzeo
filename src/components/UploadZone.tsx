import React, { useRef, useState } from 'react';
import { UploadCloud, File, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UploadZoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  maxSizeBytes: number; // 50MB
  totalSizeBytesSelected: number;
}

export default function UploadZone({ onFilesSelected, maxSizeBytes, totalSizeBytesSelected }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorNotice(null);

    // Calc upcoming aggregate size
    let incomingSize = 0;
    const fileArray: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      incomingSize += f.size;
      fileArray.push(f);
    }

    if (totalSizeBytesSelected + incomingSize > maxSizeBytes) {
      setErrorNotice('Você atingiu o limite da Versão Beta: o limite de upload combinado é de 50MB no total por transferência.');
      return;
    }

    onFilesSelected(fileArray);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input value to allow selecting same file again
      e.target.value = '';
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 font-sans">
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        id="drag-drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full min-h-[220px] rounded-3xl border-dashed flex flex-col items-center justify-center p-6 text-center transition-all duration-500 cursor-pointer ${
          isDragActive
            ? 'border-[1.5px] border-primary bg-primary/5 text-foreground scale-[0.99] shadow-inner'
            : 'border border-border bg-background hover:bg-muted/30 text-muted-foreground hover:text-foreground shadow-sm'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          className="hidden"
          onChange={handleSelectFiles}
          id="file-selector-input"
        />

        <div className="flex flex-col items-center gap-4">
          <motion.div animate={{ scale: isDragActive ? 1.1 : 1, y: isDragActive ? -5 : 0 }} className="p-4 rounded-full bg-background border border-border shadow-sm text-primary transition-transform duration-300">
            <UploadCloud className="w-8 h-8" />
          </motion.div>
          <div className="space-y-1">
            <p className="font-semibold text-sm md:text-base text-foreground tracking-tight">
              Solte seus arquivos aqui ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground/80 font-medium">
              Qualquer formato é aceito. Limite de até 50MB por link (Versão Beta).
            </p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
      {errorNotice && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} id="upload-zone-error" className="flex items-start gap-2 bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded-xl text-xs overflow-hidden">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorNotice}</span>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
