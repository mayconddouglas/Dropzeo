import { FileItem } from '../types.js';
import { formatBytes } from '../lib/utils.js';
import { File, Image, Video, FileText, Download, Music } from 'lucide-react';

interface FilePreviewProps {
  files: FileItem[];
  isExpired: boolean;
  onDownloadTriggered?: () => void;
}

export default function FilePreview({ files, isExpired, onDownloadTriggered }: FilePreviewProps) {
  
  const getFileIcon = (file: FileItem) => {
    const type = file.mime_type || '';
    if (type.startsWith('image/')) return <Image className="w-5 h-5 text-[#6366f1]" />;
    if (type.startsWith('video/')) return <Video className="w-5 h-5 text-[#10b981]" />;
    if (type.startsWith('audio/')) return <Music className="w-5 h-5 text-[#ec4899]" />;
    if (type.includes('pdf') || type.includes('text') || type.includes('document')) {
      return <FileText className="w-5 h-5 text-[#f59e0b]" />;
    }
    return <File className="w-5 h-5 text-white" />;
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">
          Arquivos da Sessão ({files.length})
        </h4>
      </div>

      <div className="space-y-4">
        {files.map((file) => {
          const fileIcon = getFileIcon(file);
          const hasPreview = isImageFile(file) || isVideoFile(file) || isAudioFile(file);

          return (
            <div
              key={file.id}
              id={`recipient-file-item-${file.id}`}
              className="bg-[#141414] border border-[#262626] rounded-xl overflow-hidden transition-all duration-200 hover:border-[#262626]"
            >
              {/* Inline interactive previews */}
              {hasPreview && !isExpired && (
                <div className="bg-[#0a0a0a] border-b border-[#262626] flex items-center justify-center overflow-hidden">
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
                </div>
              )}

              {/* Detail row */}
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2.5 bg-[#0a0a0a] border border-[#262626] rounded-lg shrink-0">
                    {fileIcon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate" title={file.original_name}>
                      {file.original_name}
                    </p>
                    <p className="text-xs text-[#a3a3a3] mt-0.5">
                      {formatBytes(file.size_bytes)} ({file.mime_type || 'Desconhecido'})
                    </p>
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
                    className="flex items-center justify-center p-2.5 bg-[#6366f1]/10 text-[#6366f1] hover:bg-[#6366f1] hover:text-white rounded-xl transition-all border border-[#6366f1]/20 cursor-pointer"
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
