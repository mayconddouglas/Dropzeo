import { useState } from 'react';
import { FileItem } from '../types.js';
import { formatBytes } from '../lib/utils.js';
import { File, Image, Video, FileText, Download, Music, Eye, EyeOff } from 'lucide-react';

interface FilePreviewProps {
  files: FileItem[];
  isExpired: boolean;
  onDownloadTriggered?: () => void;
}

export default function FilePreview({ files, isExpired, onDownloadTriggered }: FilePreviewProps) {
  const [openPreviews, setOpenPreviews] = useState<Record<string, boolean>>({});

  const getFileIcon = (file: FileItem) => {
    const type = file.mime_type || '';
    if (type.startsWith('image/')) return <Image className="w-5 h-5 text-primary" />;
    if (type.startsWith('video/')) return <Video className="w-5 h-5 text-[#10b981]" />;
    if (type.startsWith('audio/')) return <Music className="w-5 h-5 text-[#ec4899]" />;
    if (type.includes('pdf') || type.includes('text') || type.includes('document')) {
      return <FileText className="w-5 h-5 text-[#f59e0b]" />;
    }
    return <File className="w-5 h-5 text-foreground" />;
  };

  const isImageFile = (file: FileItem) => {
    return file.mime_type && file.mime_type.startsWith('image/');
  };

  const isVideoFile = (file: FileItem) => {
    return file.mime_type && file.mime_type.startsWith('video/');
  };

  const isAudioFile = (file: FileItem) => {
    return file.mime_type && file.mime_type.startsWith('audio/');
  };

  const isPdfFile = (file: FileItem) => {
    return file.mime_type && (file.mime_type === 'application/pdf' || file.mime_type.includes('pdf'));
  };

  const togglePreview = (id: string) => {
    setOpenPreviews((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const isPreviewOpen = (id: string, file: FileItem) => {
    if (openPreviews[id] !== undefined) {
      return openPreviews[id];
    }
    // Automatically preview images, but collapse heavier media (PDF, Video, MP3) until toggled saved bandwidth
    return isImageFile(file);
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Arquivos da Sessão ({files.length})
        </h4>
      </div>

      <div className="space-y-4">
        {files.map((file) => {
          const fileIcon = getFileIcon(file);
          const hasPreview = isImageFile(file) || isVideoFile(file) || isAudioFile(file) || isPdfFile(file);
          const isOpen = isPreviewOpen(file.id, file);

          return (
            <div
              key={file.id}
              id={`recipient-file-item-${file.id}`}
              className="bg-card border border-border rounded-xl overflow-hidden transition-all duration-200 hover:border-muted-foreground/25"
            >
              {/* Inline interactive previews */}
              {hasPreview && isOpen && !isExpired && (
                <div className="bg-background border-b border-border flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-300">
                  {isImageFile(file) && (
                    <img
                      src={file.download_url}
                      alt={file.original_name}
                      referrerPolicy="no-referrer"
                      className="max-h-[220px] w-auto object-contain max-w-full"
                    />
                  )}
                  {isVideoFile(file) && (
                    <video
                      src={file.download_url}
                      controls
                      playsInline
                      className="max-h-[240px] w-full"
                    />
                  )}
                  {isAudioFile(file) && (
                    <div className="p-4 w-full">
                      <audio src={file.download_url} controls className="w-full" />
                    </div>
                  )}
                  {isPdfFile(file) && (
                    <div className="w-full flex flex-col p-3 bg-card/30">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40">
                        <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#f59e0b]" />
                          Visualização Direta do PDF
                        </span>
                        <a 
                          href={file.download_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] text-primary hover:underline font-medium"
                        >
                          Abrir em nova aba ↗
                        </a>
                      </div>
                      <iframe
                        src={`${file.download_url}#toolbar=0&navpanes=0`}
                        title={file.original_name}
                        className="w-full h-[320px] rounded-lg border border-border bg-white"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Detail row */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2.5 bg-background border border-border rounded-lg shrink-0">
                    {fileIcon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate" title={file.original_name}>
                      {file.original_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                      <span>{formatBytes(file.size_bytes)}</span>
                      <span>•</span>
                      <span className="font-mono text-[11px] truncate max-w-[124px]">{file.mime_type || 'Desconhecido'}</span>
                      {hasPreview && !isExpired && (
                        <>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => togglePreview(file.id)}
                            className="text-primary hover:text-primary/80 font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1 focus:outline-none"
                          >
                            {isOpen ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Ocultar prévia</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Ver prévia</span>
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Individual Download Action */}
                {!isExpired && (
                  <a
                    id={`download-individual-btn-${file.id}`}
                    href={file.download_url}
                    download={file.original_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => onDownloadTriggered?.()}
                    className="flex items-center justify-center p-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl transition-all border border-primary/20 cursor-pointer"
                    title={`Baixar ${file.original_name}`}
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
