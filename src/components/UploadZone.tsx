import React, { useRef, useState } from 'react';
import { UploadCloud, FolderOpen } from 'lucide-react';

interface UploadZoneProps {
  onFilesSelected: (files: FileList | File[]) => void;
  maxSizeBytes: number;
  totalSizeBytesSelected: number;
}

export default function UploadZone({ onFilesSelected, maxSizeBytes, totalSizeBytesSelected }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorNotice(null);
    let incomingSize = 0;
    const fileArray: File[] = [];
    for (let i = 0; i < files.length; i++) {
      incomingSize += files[i].size;
      fileArray.push(files[i]);
    }
    if (totalSizeBytesSelected + incomingSize > maxSizeBytes) {
      setErrorNotice('Limite de 50MB por transferência atingido.');
      return;
    }
    onFilesSelected(fileArray);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    processFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <div
        onDragEnter={handleDrag}
        onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 py-12 px-6
          ${isDragActive
            ? 'border-cyan-400 bg-cyan-400/5 dropzone-active'
            : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.03]'
          }`}
      >
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
          isDragActive
            ? 'bg-cyan-400/15 text-cyan-400'
            : 'bg-white/5 text-white/30'
        }`}>
          <UploadCloud className="w-7 h-7" strokeWidth={1.5} />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-white/70">
            {isDragActive ? 'Solte os arquivos aqui' : 'Arraste arquivos ou clique para selecionar'}
          </p>
          <p className="text-xs text-white/25">Qualquer formato · até 50 MB por transferência</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/8 text-xs text-white/40 hover:text-white/60 transition-colors">
          <FolderOpen className="w-3.5 h-3.5" />
          Escolher arquivos
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => processFiles(e.target.files)}
        />
      </div>
      {errorNotice && (
        <p className="text-xs text-red-400 flex items-center gap-1.5 px-1">
          <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
          {errorNotice}
        </p>
      )}
    </div>
  );
}
