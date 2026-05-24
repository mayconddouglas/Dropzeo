import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { generateToken, formatBytes } from './lib/utils.js';
import { SelectedFile, UploadSession, ExpirationOption } from './types.js';
import UploadZone from './components/UploadZone.js';
import FileList from './components/FileList.js';
import ExpirationSelector from './components/ExpirationSelector.js';
import ShareLink from './components/ShareLink.js';
import FilePreview from './components/FilePreview.js';
import CountdownTimer from './components/CountdownTimer.js';
import AuthModal from './components/AuthModal.js';
import {
  File,
  Shield,
  UploadCloud,
  LogOut,
  User,
  ExternalLink,
  Loader2,
  AlertCircle,
  Download,
  Terminal,
  Info,
  Lock,
  Clock,
  RotateCcw,
  Menu,
  X
} from 'lucide-react';
import JSZip from 'jszip';

// shadcn/ui components integration
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Toaster, toast } from 'sonner';

export default function App() {
  // ROUTING
  const [isRecipientView, setIsRecipientView] = useState(false);
  const [routeToken, setRouteToken] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // AUTH STATE
  const [user, setUser] = useState<any>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // UPLOADER STATE
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [expiration, setExpiration] = useState<ExpirationOption>('15min');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<string>('');
  const [uploadEta, setUploadEta] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [shareResult, setShareResult] = useState<{ token: string; expiresAt: string } | null>(null);

  // SENDER DASHBOARD STATE (AUTHENTICATED)
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [mySessions, setMySessions] = useState<any[]>([]);
  const [mySessionsLoading, setMySessionsLoading] = useState(false);
  const [mySessionsError, setMySessionsError] = useState<string | null>(null);

  // SECURITY & PRIVACY OPTIONS (SENDER)
  const [selfDestruct, setSelfDestruct] = useState(false);
  const [password, setPassword] = useState('');

  // RECIPIENT VIEW STATE
  const [recipientSession, setRecipientSession] = useState<UploadSession | null>(null);
  const [recipientPassword, setRecipientPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientError, setRecipientError] = useState<{ status: 'NOT_FOUND' | 'EXPIRED' | 'ERROR'; message: string } | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [isExpiredRecipientLink, setIsExpiredRecipientLink] = useState(false);

  // AUTH MODAL TRIGGERS
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingUploadAfterLogin, setPendingUploadAfterLogin] = useState(false);

  // 1. Initial Router & Session Loading
  useEffect(() => {
    // Inject the theme preset class dark to index page
    document.documentElement.classList.add('dark');

    // Basic route detection
    const match = window.location.pathname.match(/^\/s\/([^/]+)/);
    if (match) {
      setIsRecipientView(true);
      setRouteToken(match[1]);
    }

    // Standard session tracking
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setSessionToken(session?.access_token ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setSessionToken(session?.access_token ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch Recipient Data on Demand
  useEffect(() => {
    if (isRecipientView && routeToken) {
      fetchRecipientSession();
    }
  }, [isRecipientView, routeToken]);

  const fetchRecipientSession = async () => {
    setRecipientLoading(true);
    setRecipientError(null);
    try {
      const url = `/api/session/${routeToken}${recipientPassword ? `?password=${encodeURIComponent(recipientPassword)}` : ''}`;
      const res = await fetch(url);
      const contentType = res.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');

      if (!res.ok) {
        let errStatus: 'NOT_FOUND' | 'EXPIRED' | 'ERROR' = 'NOT_FOUND';
        let errMsg = 'Não foi possível carregar a sessão.';

        if (isJson) {
          const errJson = await res.json();
          if (errJson.error === 'PASSWORD_REQUIRED') {
            setPasswordRequired(true);
            setPasswordFeedback(recipientPassword ? 'Senha incorreta! Verifique os dígitos e tente de novo.' : null);
            setRecipientError(null);
            return;
          }
          errStatus = errJson.error === 'EXPIRED' ? 'EXPIRED' : 'NOT_FOUND';
          errMsg = errJson.message || errMsg;
        }

        setRecipientError({
          status: errStatus,
          message: errMsg
        });

        if (errStatus === 'EXPIRED') {
          setIsExpiredRecipientLink(true);
        }
        return;
      }

      if (isJson) {
        const data = await res.json();
        setRecipientSession(data);
        setPasswordRequired(false);
        setPasswordFeedback(null);
      } else {
        throw new Error('Retornou uma resposta de servidor inválida (esperava JSON, mas recebeu HTML ou texto).');
      }
    } catch (err) {
      console.error('Error fetching recipient token:', err);
      setRecipientError({ status: 'ERROR', message: 'Houve uma falha de conexão com os servidores do Dropzeo.' });
    } finally {
      setRecipientLoading(false);
    }
  };

  // 3. User Actions
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleFilesSelected = (files: File[]) => {
    const updated = files.map((file) => {
      const sf: SelectedFile = {
        id: crypto.randomUUID(),
        file: file,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: 'pending'
      };
      return sf;
    });
    setSelectedFiles((prev) => [...prev, ...updated]);
    setUploadError(null);
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const totalBytesSelected = selectedFiles.reduce((acc, curr) => acc + curr.size, 0);

  // 4. Start Transfer (Gerar Link)
  const handleStartUpload = async () => {
    if (selectedFiles.length === 0) {
      setUploadError('Por favor, selecione ao menos um arquivo para prosseguir.');
      return;
    }

    // Limit check
    const LIMIT_20MB = 20 * 1024 * 1024; // 20,971,520 bytes
    if (!user && totalBytesSelected > LIMIT_20MB) {
      setPendingUploadAfterLogin(true);
      setIsAuthModalOpen(true);
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    setUploadProgress(0);
    setUploadSpeed('Iniciando...');
    setUploadEta('Calculando...');

    // Initialise XMLHttpRequest so we can track exact live percentages
    const formData = new FormData();
    selectedFiles.forEach((f) => {
      formData.append('files', f.file);
    });
    formData.append('expiration', expiration);
    formData.append('self_destruct', String(selfDestruct));
    if (password) {
      formData.append('password', password);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    // Attach user auth token if logged in
    if (sessionToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${sessionToken}`);
    }

    const startTime = Date.now();

    // Update progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);

        // Live speed & ETA calculations
        const timeElapsed = (Date.now() - startTime) / 1000; // in seconds
        if (timeElapsed > 0.15) {
          const speedBytesPerSec = event.loaded / timeElapsed;
          
          let speedStr = '';
          if (speedBytesPerSec >= 1024 * 1024) {
            speedStr = `${(speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
          } else if (speedBytesPerSec >= 1024) {
            speedStr = `${(speedBytesPerSec / 1024).toFixed(1)} KB/s`;
          } else {
            speedStr = `${Math.round(speedBytesPerSec)} B/s`;
          }
          setUploadSpeed(speedStr);

          if (percent < 100 && speedBytesPerSec > 0) {
            const bytesRemaining = event.total - event.loaded;
            const etaSeconds = bytesRemaining / speedBytesPerSec;
            if (etaSeconds < 1) {
              setUploadEta('Quase pronto...');
            } else if (etaSeconds < 60) {
              setUploadEta(`restam ~${Math.round(etaSeconds)}s`);
            } else {
              const mins = Math.floor(etaSeconds / 60);
              const secs = Math.round(etaSeconds % 60);
              setUploadEta(`restam ~${mins}m ${secs}s`);
            }
          } else {
            setUploadEta('Finalizando...');
          }
        } else {
          setUploadSpeed('Calculando...');
          setUploadEta('Quase lá...');
        }

        setSelectedFiles((prev) =>
          prev.map((f) => ({
            ...f,
            progress: percent,
            status: 'uploading'
          }))
        );
      }
    };

    // Load completions
    xhr.onload = () => {
      setUploadLoading(false);
      const contentType = xhr.getResponseHeader('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          if (!isJson) {
            throw new Error('O servidor retornou uma resposta inválida (esperava JSON, mas recebeu HTML ou texto).');
          }
          const data = JSON.parse(xhr.responseText);
          setSelectedFiles((prev) => prev.map((f) => ({ ...f, progress: 100, status: 'completed' })));
          setShareResult({
            token: data.share_token,
            expiresAt: data.expires_at
          });
        } catch (err: any) {
          const errorMsg = err.message || 'Erro ao carregar resposta do servidor.';
          setUploadError(errorMsg);
          setSelectedFiles((prev) => prev.map((f) => ({ ...f, status: 'failed', error: errorMsg })));
        }
      } else {
        let errorMsg = 'Infelizmente, ocorreu uma falha ao enviar os seus arquivos.';
        if (isJson) {
          try {
            const res = JSON.parse(xhr.responseText);
            errorMsg = res.error || res.message || errorMsg;
          } catch (_) {}
        } else {
          errorMsg = `Erro do servidor (${xhr.status}): Resposta inválida ou serviço indisponível.`;
        }
        setUploadError(errorMsg);
        setSelectedFiles((prev) => prev.map((f) => ({ ...f, status: 'failed', error: errorMsg })));
      }
    };

    xhr.onerror = () => {
      setUploadLoading(false);
      setUploadError('Falha crítica de conexão de rede.');
      setSelectedFiles((prev) => prev.map((f) => ({ ...f, status: 'failed', error: 'Falha de rede' })));
    };

    xhr.send(formData);
  };

  // Success handler for Modal login redirection
  const handleAuthSuccess = () => {
    if (pendingUploadAfterLogin) {
      setPendingUploadAfterLogin(false);
      // Wait minor duration for token insertion, then upload
      setTimeout(() => {
        handleStartUpload();
      }, 500);
    }
  };

  const fetchMySessions = async () => {
    if (!sessionToken) return;
    setMySessionsLoading(true);
    setMySessionsError(null);
    try {
      const res = await fetch('/api/my-sessions', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      if (!res.ok) {
        throw new Error('Falha ao obter histórico de transferências.');
      }
      const data = await res.json();
      setMySessions(data);
    } catch (err: any) {
      console.error(err);
      setMySessionsError(err.message || 'Erro ao carregar.');
    } finally {
      setMySessionsLoading(false);
    }
  };

  const handleRevokeSession = async (token: string) => {
    if (!sessionToken) return;
    if (!confirm('Tem certeza que deseja apagar essa transferência e excluir todos os seus arquivos do servidor? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const res = await fetch(`/api/session/${token}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      if (res.ok) {
        toast.success('Link revogado e arquivos permanentemente apagados! 🗑️');
        // Refresh list
        fetchMySessions();
      } else {
        const errJson = await res.json();
        toast.error(errJson.message || 'Falha ao revogar a transferência.');
      }
    } catch (err) {
      console.error('Revocation request failed:', err);
      toast.error('Ocorreu um erro ao excluir a transferência.');
    }
  };

  // Trigger loading dashboard data when tab switches or user alters
  useEffect(() => {
    if (activeTab === 'history' && user) {
      fetchMySessions();
    }
  }, [activeTab, sessionToken, user]);

  const triggerSelfDestructIfNeeded = async () => {
    // 1. Increment download count
    if (routeToken) {
      try {
        await fetch(`/api/session/${routeToken}/download`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to register download event:', err);
      }
    }

    // 2. Self destruct if enabled
    if (recipientSession?.self_destruct) {
      try {
        await fetch(`/api/session/${routeToken}/downloaded`, { method: 'POST' });
        setIsExpiredRecipientLink(true);
        setRecipientSession(null);
        setRecipientError({
          status: 'EXPIRED',
          message: 'Esta transferência se autodestruiu com sucesso após o download solicitado!'
        });
      } catch (err) {
        console.error('Failed to trigger self destruct cleanup:', err);
      }
    }
  };

  // ZIP Packing
  const handleDownloadAll = async () => {
    if (!recipientSession || recipientSession.files.length === 0) return;

    if (recipientSession.files.length === 1) {
      // Direct opening for single item
      const f = recipientSession.files[0];
      const link = document.createElement('a');
      link.href = f.download_url;
      link.setAttribute('download', f.original_name);
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        triggerSelfDestructIfNeeded();
      }, 1500);
      return;
    }

    setIsZipping(true);
    try {
      const zip = new JSZip();
      
      for (const fileItem of recipientSession.files) {
        const response = await fetch(fileItem.download_url);
        if (!response.ok) throw new Error(`Failed to fetch file ${fileItem.original_name}`);
        const blob = await response.blob();
        zip.file(fileItem.original_name, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = window.URL.createObjectURL(zipBlob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `dropzeo-arquivos-${routeToken}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      triggerSelfDestructIfNeeded();
    } catch (err) {
      console.error('ZIP generation failure:', err);
      // fallback download individually sequentially
      toast.warning('Ocorreu um problema ao compactar os arquivos. Iniciando downloads individuais em abas...');
      recipientSession.files.forEach((file) => {
        const w = window.open(file.download_url, '_blank');
      });

      setTimeout(() => {
        triggerSelfDestructIfNeeded();
      }, 3000);
    } finally {
      setIsZipping(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-card justify-between p-6">
      <div className="space-y-8">
        {/* Branding */}
        <div className="flex flex-col gap-1">
          <a href="/" className="flex items-start gap-1.5 group">
            <span className="font-extrabold text-2xl tracking-tight text-foreground leading-none">
              Dropzeo
            </span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-tight bg-border/30 px-1.5 py-0.5 rounded-md border border-border -mt-1 scale-[0.85] origin-left select-none">
              by <span className="text-primary font-semibold">brazeo.ai</span>
            </span>
          </a>
          <p className="text-[11px] text-muted-foreground leading-snug mt-1">
            Envie arquivos grandes temporariamente sem complicações.
          </p>
        </div>

        {/* Menu Navigation */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2">
            Navegação
          </p>
          
          {/* Option: Enviar Arquivos */}
          <button
            onClick={() => {
              setActiveTab('create');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-primary text-primary-foreground shadow-md font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <UploadCloud className="w-4 h-4 shrink-0" />
            <span>Enviar Arquivos</span>
          </button>

          {/* Option: Meus Links */}
          <button
            onClick={() => {
              if (!user) {
                toast.info('Para ver seu histórico e monitorar estatísticas, faça login na sua conta.');
                setIsAuthModalOpen(true);
              } else {
                setActiveTab('history');
              }
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-primary text-primary-foreground shadow-md font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Meus Links</span>
            </div>
            {!user && (
              <Lock className="w-3.5 h-3.5 text-muted-foreground/50" />
            )}
          </button>
        </div>
      </div>

      {/* Account Profile Footer Section */}
      <div className="border-t border-border/60 pt-6">
        {authLoading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          </div>
        ) : user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img 
                src={user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.email || 'dropzeo')}`} 
                alt="Avatar" 
                className="w-8 h-8 rounded-full object-cover border border-border bg-background"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-semibold text-foreground truncate">
                  {user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-muted-foreground truncate" title={user.email}>
                  {user.email}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full text-xs hover:bg-destructive hover:text-destructive-foreground hover:border-destructive text-muted-foreground transition-all cursor-pointer flex items-center justify-center gap-2 rounded-xl border-border bg-transparent"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da conta</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed text-left">
              Faça login para salvar seus links de transferência e acompanhar envios ativos.
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full text-xs bg-primary hover:bg-primary/95 text-primary-foreground font-semibold py-2 rounded-xl cursor-pointer"
            >
              Entrar / Criar Conta
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex selection:bg-primary selection:text-primary-foreground">
      <Toaster position="top-right" richColors />

      {/* 1. SIDEBAR FOR DESKTOP (Always visible on md+) */}
      <aside className="w-72 border-r border-border h-screen sticky top-0 hidden md:flex flex-col justify-between shrink-0 bg-card">
        {sidebarContent}
      </aside>

      {/* 2. MOBILE DRAWER SIDEBAR WITH OVERLAY */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-card border-r border-border transition-transform duration-300 md:hidden flex flex-col justify-between ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="absolute top-4 right-4 md:hidden">
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {sidebarContent}
      </aside>

      {/* 3. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        
        {/* MOBILE TOP BAR (Only visible on mobile screens) */}
        <header className="md:hidden border-b border-border/40 py-4 px-6 flex items-center justify-between shrink-0 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <a href="/" className="flex items-start gap-1.5 group">
            <span className="font-extrabold text-xl tracking-tight text-foreground leading-none">
              Dropzeo
            </span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-tight bg-border/20 px-1 py-0.5 rounded-md border border-border -mt-1 scale-[0.8] origin-left select-none">
              by <span className="text-primary font-semibold">brazeo.ai</span>
            </span>
          </a>

          <div className="flex items-center gap-3">
            {/* Short account trigger or sign in button in mobile top bar */}
            {!user ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAuthModalOpen(true)}
                className="text-xs py-1.5 px-3 rounded-lg border-border bg-transparent"
              >
                Entrar
              </Button>
            ) : (
              <div 
                className="flex items-center gap-2 cursor-pointer bg-card border border-border rounded-lg py-1 px-2.5 hover:bg-muted transition-all"
                onClick={() => {
                  setIsSidebarOpen(true);
                }}
              >
                <img 
                  src={user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.email || 'dropzeo')}`} 
                  alt="Avatar" 
                  className="w-4 h-4 rounded-full object-cover"
                />
                <span className="text-[11px] font-medium max-w-[64px] truncate">
                  {user.user_metadata?.name || user.email?.split('@')[0]}
                </span>
              </div>
            )}

            {/* Menu Trigger */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 -mr-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* WORKSPACE CONTENT CONTENT CONTAINER */}
        <main className="max-w-2xl w-full mx-auto px-4 py-8 md:py-16 flex-1 flex flex-col justify-center">
        
        {/* ======================= RECIPIENT SCREEN ======================= */}
        {isRecipientView && (
          <div className="space-y-6">
            {recipientLoading ? (
              <div className="text-center py-16 space-y-4 bg-card border border-border rounded-2xl">
                <Loader2 className="w-9 h-9 text-primary animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Localizando arquivos compartilhados...</p>
              </div>
            ) : passwordRequired ? (
              <div className="bg-card border border-border rounded-2xl p-8 max-w-sm mx-auto space-y-6 text-center shadow-2xl animate-in fade-in zoom-in duration-300">
                <div className="p-3.5 bg-primary/15 border border-primary/25 text-primary rounded-full w-fit mx-auto">
                  <Shield className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-foreground tracking-tight">Transferência Protegida</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    O remetente protegeu este link com uma senha de acesso. Insira o código numérico para prosseguir.
                  </p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    fetchRecipientSession();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5 text-left">
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="Senha numérica de 4 a 6 dígitos"
                      className="w-full bg-background border border-border rounded-xl py-3 px-4 text-center font-bold text-base tracking-widest text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-xs placeholder:tracking-normal placeholder:font-normal placeholder:text-muted-foreground/50"
                      value={recipientPassword}
                      onChange={(e) => setRecipientPassword(e.target.value.replace(/\D/g, ''))}
                    />
                    {passwordFeedback && (
                      <p className="text-[11px] text-destructive text-center font-medium animate-pulse mt-1">
                        {passwordFeedback}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    disabled={recipientPassword.length < 4 || recipientLoading}
                    className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold text-xs uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border-none"
                  >
                    Desbloquear Arquivos
                  </Button>
                </form>
              </div>
            ) : recipientError ? (
              <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-5 animate-in fade-in duration-300">
                <div className="p-4 bg-destructive/10 rounded-full w-fit mx-auto text-destructive border border-destructive/20">
                  <AlertCircle className="w-9 h-9" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-foreground">Oops! Este link não está mais disponível</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    {recipientError.status === 'EXPIRED' 
                      ? 'O tempo do link expirou e os arquivos foram permanentemente removidos de acordo com as regras de expiração.'
                      : 'O endereço de link buscado é inválido ou nunca existiu.'}
                  </p>
                </div>
                <div className="pt-3">
                  <a
                    href="/"
                    className="inline-flex items-center gap-1.5 py-2 px-4 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-xl transition-all"
                  >
                    Ir para o Dropzeo
                  </a>
                </div>
              </div>
            ) : recipientSession ? (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-6 shadow-xl animate-in fade-in duration-300">
                
                {/* Countdown / Stats header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
                  <div className="space-y-0.5 text-left">
                    <h2 className="text-base font-bold text-foreground tracking-tight">Arquivos Disponíveis</h2>
                    <p className="text-xs text-muted-foreground">
                      Estão salvos {recipientSession.files.length} arquivo(s) somando{' '}
                      {formatBytes(recipientSession.files.reduce((a, b) => a + b.size_bytes, 0))}.
                    </p>
                  </div>
                  <CountdownTimer
                    expiresAt={recipientSession.expires_at}
                    onExpire={() => setIsExpiredRecipientLink(true)}
                    className="bg-background border border-border px-3 py-1.5 rounded-lg shrink-0"
                  />
                </div>

                {/* Self Destruct Warning Notice if enabled */}
                {recipientSession.self_destruct && !isExpiredRecipientLink && (
                  <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl leading-relaxed animate-pulse text-left">
                    <Shield className="w-5 h-5 shrink-0 text-destructive mt-0.5" />
                    <div>
                      <strong className="font-bold block text-foreground mb-0.5">Link de Autodestruição Ativo:</strong>
                      Este link e os arquivos originais serão **excluídos de forma definitiva e imediata** de nosso servidor assim que você realizar o download!
                    </div>
                  </div>
                )}

                {/* Previews & Lists */}
                <FilePreview 
                  files={recipientSession.files} 
                  isExpired={isExpiredRecipientLink} 
                  onDownloadTriggered={() => {
                     setTimeout(() => {
                       triggerSelfDestructIfNeeded();
                     }, 1500);
                  }}
                />

                {/* Download Actions */}
                {!isExpiredRecipientLink && (
                  <Button
                    id="download-all-btn"
                    onClick={handleDownloadAll}
                    disabled={isZipping}
                    className="w-full py-3.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md border-none"
                  >
                    {isZipping ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Compactando arquivos...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Baixar Todos os Ativos {recipientSession.files.length > 1 ? '(ZIP)' : ''}</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ======================= UPLOAD & GENERAL WORKFLOWS ======================= */}
        {!isRecipientView && (
          <div className="space-y-6">
            
            {/* Display Link Result View */}
            {shareResult ? (
              <ShareLink
                token={shareResult.token}
                expiresAt={shareResult.expiresAt}
                onReset={() => {
                  setShareResult(null);
                  setSelectedFiles([]);
                  setSelfDestruct(false);
                  setPassword('');
                  setActiveTab('create');
                }}
              />
            ) : activeTab === 'history' && user ? (
              /* MY LINKS / HISTORY DASHBOARD SCREEN */
              <Card className="bg-card border-border rounded-2xl p-6 space-y-5 shadow-xl animate-in fade-in duration-300">
                <div className="pb-4 border-b border-border/60 flex items-center justify-between">
                  <div className="space-y-0.5 text-left">
                    <CardTitle className="text-base font-bold text-foreground tracking-tight">Suas Transferências</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">Histórico de todos os pacotes ativos ou expirados.</CardDescription>
                  </div>
                  <button 
                    type="button"
                    onClick={() => fetchMySessions()}
                    className="p-2 hover:bg-muted/50 rounded-lg text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                    title="Atualizar painel"
                  >
                    <RotateCcw className={`w-4 h-4 ${mySessionsLoading ? 'animate-spin text-primary' : ''}`} />
                  </button>
                </div>

                {mySessionsLoading ? (
                  <div className="text-center py-12 space-y-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                    <p className="text-xs text-muted-foreground">Carregando suas transferências...</p>
                  </div>
                ) : mySessionsError ? (
                  <div className="text-center py-8 text-xs text-destructive bg-destructive/15 border border-destructive/20 rounded-xl">
                    {mySessionsError}
                  </div>
                ) : mySessions.length === 0 ? (
                  <div className="text-center py-12 space-y-2 border border-dashed border-border rounded-xl">
                    <p className="text-sm text-foreground font-medium">Nenhum link ativo localizado</p>
                    <p className="text-xs text-muted-foreground/50 max-w-xs mx-auto">Sua lista está limpa. Compartilhe um pacote de arquivos para vê-lo aqui!</p>
                    <Button 
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('create')}
                      className="mt-3 text-xs bg-primary/15 text-primary border border-primary/25 hover:bg-primary hover:text-primary-foreground px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer"
                    >
                      Criar Novo Link
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                    {mySessions.map((session) => {
                      const shareUrl = `${window.location.origin}/s/${session.share_token}`;
                      return (
                        <div key={session.id} className="p-4 bg-background/50 border border-border rounded-xl space-y-3 text-left relative hover:border-primary/40 transition-all">
                          {/* Top Row: Info and Status Badge */}
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-h-0 flex-1">
                              <span className="font-mono text-xs text-primary font-semibold select-all block truncate max-w-xs md:max-w-md">
                                {shareUrl}
                              </span>
                              <span className="text-[10px] text-muted-foreground/50 mt-0.5 block">
                                Criado em: {new Date(session.created_at).toLocaleString('pt-BR')}
                              </span>
                            </div>

                            {session.is_expired ? (
                              <span className="shrink-0 text-[10px] bg-destructive/10 border border-destructive/20 text-destructive font-bold px-2 py-0.5 rounded-md">
                                Expirado
                              </span>
                            ) : (
                              <span className="shrink-0 text-[10px] bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] font-bold px-2 py-0.5 rounded-md animate-pulse">
                                Ativo
                              </span>
                            )}
                          </div>

                          {/* Middle details metrics */}
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground bg-card/40 p-2.5 rounded-lg border border-border/50">
                            <span className="font-medium text-foreground">
                              {session.files.length} arquivo(s)
                            </span>
                            <span className="text-muted-foreground/30">•</span>
                            <span>
                              {formatBytes(session.files.reduce((acc: number, f: any) => acc + (f.size_bytes || 0), 0))}
                            </span>
                            <span className="text-muted-foreground/30">•</span>
                            <span className="flex items-center gap-1 font-mono text-foreground text-xs py-0.5 px-1.5 bg-primary/10 border border-primary/20 rounded">
                              <Download className="w-3 h-3 text-primary" />
                              {session.download_count} download(s)
                            </span>

                            {/* Extra protection flags */}
                            {(session.self_destruct || session.has_password) && (
                              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                {session.self_destruct && (
                                  <span className="flex items-center gap-0.5 text-[9px] bg-primary/15 border border-primary/25 text-primary px-1.5 py-0.5 rounded" title="Autodestruição ativa">
                                    <Shield className="w-2.5 h-2.5" />
                                    autodestrói
                                  </span>
                                )}
                                {session.has_password && (
                                  <span className="flex items-center gap-0.5 text-[9px] bg-amber-500/15 border border-amber-500/25 text-amber-400 px-1.5 py-0.5 rounded" title="Protegido por senha">
                                    <Lock className="w-2.5 h-2.5" />
                                    com senha
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Expiry countdown if active */}
                          {!session.is_expired && (
                            <div className="text-[11px] text-muted-foreground flex items-center justify-between gap-2 pt-1.5 border-t border-border/40">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-primary" />
                                <span>Expira em:</span>
                                <CountdownTimer expiresAt={session.expires_at} className="font-semibold text-foreground bg-transparent border-none p-0" />
                              </span>

                              {/* Action triggers */}
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="xs"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(shareUrl);
                                      toast.success('Link copiado com sucesso! 🔗');
                                    } catch (_) {}
                                  }}
                                  className="text-[11px] font-bold text-primary hover:text-primary-foreground px-2.5 py-1 bg-primary/10 hover:bg-primary border border-primary/20 rounded-lg transition-all cursor-pointer"
                                >
                                  Copiar
                                </Button>
                                <Button
                                  type="button"
                                  size="xs"
                                  onClick={() => handleRevokeSession(session.share_token)}
                                  className="text-[11px] font-bold text-destructive hover:text-destructive-foreground px-2.5 py-1 bg-destructive/10 hover:bg-destructive border border-destructive/20 rounded-lg transition-all cursor-pointer"
                                >
                                  Revogar Link
                                </Button>
                              </div>
                            </div>
                          )}

                          {session.is_expired && (
                            <div className="text-[11px] text-muted-foreground/50 italic">
                              Os arquivos expiraram e não podem ser mais recuperados.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ) : (
              /* Core Upload Settings & Drag zones Card */
              <div className="space-y-6">
                
                {/* Introduction texts */}
                <div className="text-center space-y-2 mb-8 animate-in fade-in duration-300">
                  {user && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 text-primary font-medium text-xs rounded-full mb-2 select-none animate-in slide-in-from-top-2 duration-300">
                      Olá, {user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0]}! 👋
                    </div>
                  )}
                  <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                    Compartilhe temporariamente sem limites
                  </h1>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Envie os seus arquivos com expiração automática. Rápido, seguro e privado.
                  </p>
                </div>

                <Card className="bg-card border border-border p-5 rounded-2xl shadow-xl space-y-5">
                  
                  {/* Drag drop dropzone */}
                  <UploadZone
                    onFilesSelected={handleFilesSelected}
                    maxSizeBytes={50 * 1024 * 1024} // 50MB
                    totalSizeBytesSelected={totalBytesSelected}
                  />

                  {/* Active selected file logs view */}
                  <FileList
                    files={selectedFiles}
                    onRemoveFile={handleRemoveFile}
                    isUploading={uploadLoading}
                  />

                  {/* Setup Expiry Options */}
                  {selectedFiles.length > 0 && (
                    <div className="pt-2 border-t border-border/40 space-y-4">
                      <ExpirationSelector value={expiration} onChange={setExpiration} />

                      {/* Security and Privacy Options Panel */}
                      <div className="p-4 bg-background/40 border border-border rounded-xl space-y-4">
                        <div className="flex items-center gap-1.5 pb-2 border-b border-border/45">
                          <Shield className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                            Segurança & Privacidade
                          </span>
                        </div>

                        {/* Self Destruct Switch */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-semibold text-foreground cursor-pointer flex items-center gap-1.5" htmlFor="self-destruct-toggle">
                              Autodestruição (Após Download)
                            </Label>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              O link e os arquivos serão apagados do servidor de forma definitiva assim que o destinatário concluir o download.
                            </p>
                          </div>
                          <div className="flex items-center pt-1">
                            <Switch
                              id="self-destruct-toggle"
                              checked={selfDestruct}
                              onCheckedChange={(checked) => setSelfDestruct(checked)}
                              className="cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Password Protection input */}
                        <div className="space-y-2 pt-2 border-t border-border/40">
                          <div className="flex items-center justify-between gap-4">
                            <div className="space-y-0.5">
                              <label className="text-sm font-semibold text-foreground flex items-center gap-1.5" htmlFor="password-input">
                                Definir Senha de Acesso (4 a 6 dígitos)
                              </label>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Crie uma senha numérica de 4 a 6 dígitos para este link. Destinatários precisarão digitá-la.
                              </p>
                            </div>
                          </div>
                          <input
                            id="password-input"
                            type="password"
                            maxLength={6}
                            placeholder="Deixe em branco para livre acesso"
                            value={password}
                            onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))} // only digits allowed
                            className="w-full bg-background border border-border text-foreground rounded-xl py-2 px-3 text-xs tracking-tight placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-all"
                          />
                        </div>
                      </div>

                      {/* Display aggregate size indicators */}
                      <div className="p-3.5 bg-background/50 rounded-xl border border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Tamanho Combinado:</span>
                        <span className="font-mono text-foreground font-medium">
                          {formatBytes(totalBytesSelected)} / 50 MB
                        </span>
                      </div>

                      {/* Warnings if over 20MB and not premium logged in */}
                      {!user && totalBytesSelected > 20 * 1024 * 1024 && (
                        <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs rounded-xl leading-relaxed">
                          <Info className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>
                            <strong>Login Obrigatório:</strong> uploads maiores que 20MB necessitam de cadastro gratuito. Seus arquivos serão retidos na lista ao se registrar.
                          </span>
                        </div>
                      )}

                      {/* General Transfer progress overlay if uploading */}
                      {uploadLoading && (
                        <div className="space-y-2.5 pt-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                              <span>Enviando arquivos...</span>
                            </span>
                            <span className="font-mono text-foreground font-bold">{uploadProgress}%</span>
                          </div>
                          <Progress value={uploadProgress} className="h-2 bg-background rounded-full overflow-hidden" />
                          
                          {(uploadSpeed || uploadEta) && (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground/85 font-mono pt-0.5 px-0.5">
                              {uploadSpeed && (
                                <span className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span>Velocidade: <strong>{uploadSpeed}</strong></span>
                                </span>
                              )}
                              {uploadEta && (
                                <span className="text-right">
                                  Tempo restante: <strong className="text-primary">{uploadEta}</strong>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Throwing backend errors */}
                      {uploadError && (
                        <div className="flex items-start gap-2.5 bg-destructive/10 text-destructive border border-destructive/20 p-3.5 rounded-xl text-xs leading-relaxed animate-shake">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{uploadError}</span>
                        </div>
                      )}

                      {/* Trigger Button */}
                      <Button
                        id="generate-link-btn"
                        type="button"
                        onClick={handleStartUpload}
                        disabled={uploadLoading || selectedFiles.length === 0}
                        className="w-full py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-sm tracking-wide transition-all select-none hover:scale-[1.005] active:scale-[0.995] cursor-pointer shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 border-none"
                      >
                        {uploadLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Enviando ({uploadProgress}%)</span>
                          </>
                        ) : (
                          <span>Gerar Link Temporário</span>
                        )}
                      </Button>
                    </div>
                  )}

                </Card>
              </div>
            )}
          </div>
        )}

      </main>

      {/* 3. LOWER FOOTER */}
      <footer id="app-footer" className="max-w-2xl w-full mx-auto px-4 py-6 border-t border-border/45 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3 mt-auto">
        <p className="font-mono text-[11px]">
          Dropzeo © 2026. Todos os arquivos são auto-destruídos após o tempo estipulado.
        </p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span>Encriptação local e na nuvem</span>
          </span>
        </div>
      </footer>

      </div> {/* Close 3. MAIN WORKSPACE */}

      {/* AUTHENTICATION MODAL */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingUploadAfterLogin(false);
        }}
        onSuccess={handleAuthSuccess}
      />

    </div>
  );
}
