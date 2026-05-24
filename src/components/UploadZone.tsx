import React, { useRef, useState } from 'react';
import { UploadCloud, File, AlertCircle } from 'lucide-react';

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
      <div
        id="drag-drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full min-h-[220px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all duration-200 cursor-pointer ${
          isDragActive
            ? 'border-primary bg-primary/5 text-foreground scale-[0.99]'
            : 'border-border bg-card/45 hover:border-primary/60 text-muted-foreground hover:text-foreground'
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
          <div className={`p-4 rounded-full bg-card border border-border text-primary transition-transform duration-300 ${isDragActive ? 'scale-110' : ''}`}>
            <UploadCloud className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-sm md:text-base text-foreground">
              Solte seus arquivos aqui ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground">
              Qualquer formato é aceito. Limite de até 50MB por link (Versão Beta).
            </p>
          </div>
        </div>
      </div>

      {errorNotice && (
        <div id="upload-zone-error" className="flex items-start gap-2 bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded-xl text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorNotice}</span>
        </div>
      )}
    </div>
  );
}
