export interface FileItem {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  download_url: string;
}

export interface UploadSession {
  share_token: string;
  expires_at: string;
  files: FileItem[];
  self_destruct?: boolean;
  has_password?: boolean;
}

export interface SelectedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

export type ExpirationOption = '5min' | '15min' | '30min';
