import { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabase.js';
import { generateToken, formatBytes } from './lib/utils.js';
import { SelectedFile, UploadSession, ExpirationOption } from './types.js';
import UploadZone from './components/UploadZone.js';
import FileList from './components/FileList.js';
import ExpirationSelector from './components/ExpirationSelector.js';
import ShareLink from './components/ShareLink.js';
import CountdownTimer from './components/CountdownTimer.js';
import AuthModal from './components/AuthModal.js';
import {
  Upload, Shield, LogOut, User, Download, Lock, Clock,
  RotateCcw, Menu, X, Zap, Link2, History, AlertTriangle,
  Eye, Trash2, Copy, Check, ChevronRight, Loader2, ArrowLeft,
  Package, FileText, Globe, KeyRound
} from 'lucide-react';
import JSZip from 'jszip';
import { Toaster, toast } from 'sonner';

export default function App() {
  // ROUTING
  const [isRecipientView, setIsRecipientView] = useState(false);
  const [routeToken, setRouteToken] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // AUTH
  const [user, setUser] = useState<any>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingUploadAfterLogin, setPendingUploadAfterLogin] = useState(false);

  // UPLOAD STATE
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [expiration, setExpiration] = useState<ExpirationOption>('15min');
  const [selfDestruct, setSelfDestruct] = useState(false);
  const [password, setPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [uploadEta, setUploadEta] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [shareResult, setShareResult] = useState<{ token: string; expiresAt: string } | null>(null);

  // NAVIGATION
  const [activeView, setActiveView] = useState<'upload' | 'links'>('upload');

  // MY LINKS
  const [mySessions, setMySessions] = useState<any[]>([]);
  const [mySessionsLoading, setMySessionsLoading] = useState(false);
  const [mySessionsError, setMySessionsError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // RECIPIENT
  const [recipientSession, setRecipientSession] = useState<UploadSession | null>(null);
  const [recipientPassword, setRecipientPassword] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientError, setRecipientError] = useState<{ status: string; message: string } | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  // ─── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.add('dark');
    const match = window.location.pathname.match(/^\/s\/([^/]+)/);
    if (match) { setIsRecipientView(true); setRouteToken(match[1]); }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setSessionToken(session?.access_token ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setSessionToken(session?.access_token ?? null);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (isRecipientView && routeToken) fetchRecipientSession(); }, [isRecipientView, routeToken]);
  useEffect(() => { if (activeView === 'links' && user) fetchMySessions(); }, [activeView, sessionToken, user]);

  // ─── Recipient ───────────────────────────────────────────────────────────
  const fetchRecipientSession = async () => {
    setRecipientLoading(true);
    setRecipientError(null);
    try {
      const url = `/api/session/${routeToken}${recipientPassword ? `?password=${encodeURIComponent(recipientPassword)}` : ''}`;
      const res = await fetch(url);
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (!res.ok) {
        if (isJson) {
          const err = await res.json();
          if (err.error === 'PASSWORD_REQUIRED') {
            setPasswordRequired(true);
            setPasswordFeedback(recipientPassword ? 'Senha incorreta.' : null);
            setRecipientError(null);
            return;
          }
          if (err.error === 'NOT_FOUND') { setRecipientError({ status: 'NOT_FOUND', message: 'Link não encontrado ou expirado.' }); return; }
        }
        setRecipientError({ status: 'ERROR', message: 'Erro ao carregar.' });
        return;
      }
      const data = await res.json();
      if (data.is_expired) { setRecipientError({ status: 'EXPIRED', message: 'Este link expirou.' }); return; }
      setRecipientSession(data);
      setPasswordRequired(false);
      setPasswordFeedback(null);
    } catch { setRecipientError({ status: 'ERROR', message: 'Erro de conexão.' }); }
    finally { setRecipientLoading(false); }
  };

  const handleDownloadAll = async () => {
    if (!recipientSession) return;
    if (recipientSession.files.length === 1) {
      const f = recipientSession.files[0];
      const a = document.createElement('a');
      a.href = f.download_url; a.download = f.original_name; a.click();
      await triggerDownloaded();
      return;
    }
    setIsZipping(true);
    try {
      const zip = new JSZip();
      await Promise.all(recipientSession.files.map(async (f) => {
        const res = await fetch(f.download_url);
        zip.file(f.original_name, await res.blob());
      }));
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dropzeo-files.zip'; a.click();
      await triggerDownloaded();
    } catch { toast.error('Erro ao compactar arquivos.'); }
    finally { setIsZipping(false); }
  };

  const triggerDownloaded = async () => {
    if (!routeToken) return;
    try { await fetch(`/api/session/${routeToken}/download`, { method: 'POST' }); } catch {}
    if (recipientSession?.self_destruct) {
      try { await fetch(`/api/session/${routeToken}/downloaded`, { method: 'POST' }); } catch {}
      setRecipientError({ status: 'EXPIRED', message: 'Link autodestruído após download.' });
      setRecipientSession(null);
    }
  };

  // ─── Upload ──────────────────────────────────────────────────────────────
  const handleFilesSelected = (files: FileList | File[]) => {
    const newFiles: SelectedFile[] = Array.from(files).map((f) => ({
      id: generateToken(8), file: f, name: f.name, size: f.size, type: f.type, progress: 0, status: 'pending'
    }));
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (id: string) => setSelectedFiles((prev) => prev.filter((f) => f.id !== id));

  const totalBytes = selectedFiles.reduce((s, f) => s + f.size, 0);

  const handleStartUpload = () => {
    if (!user) { setPendingUploadAfterLogin(true); setIsAuthModalOpen(true); return; }
    if (selectedFiles.length === 0) { toast.error('Selecione ao menos um arquivo.'); return; }
    if (password && (password.length < 4 || password.length > 6 || !/^\d+$/.test(password))) {
      toast.error('A senha deve ter entre 4 e 6 dígitos numéricos.'); return;
    }
    doUpload();
  };

  const doUpload = () => {
    setUploading(true); setUploadProgress(0); setUploadError(null); setUploadSpeed(''); setUploadEta('Calculando...');
    const fd = new FormData();
    selectedFiles.forEach((f) => fd.append('files', f.file));
    fd.append('expiration', expiration);
    fd.append('self_destruct', String(selfDestruct));
    if (password) fd.append('password', password);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    if (sessionToken) xhr.setRequestHeader('Authorization', `Bearer ${sessionToken}`);

    const startTime = Date.now();
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const pct = Math.round((ev.loaded / ev.total) * 100);
      setUploadProgress(pct);
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > 0.15) {
        const spd = ev.loaded / elapsed;
        setUploadSpeed(spd >= 1048576 ? `${(spd / 1048576).toFixed(1)} MB/s` : `${(spd / 1024).toFixed(0)} KB/s`);
        const eta = (ev.total - ev.loaded) / spd;
        setUploadEta(eta < 60 ? `${Math.ceil(eta)}s` : `${Math.ceil(eta / 60)}m`);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status === 200 && data.share_token) {
          setShareResult({ token: data.share_token, expiresAt: data.expires_at });
          toast.success('Link criado com sucesso!');
        } else {
          setUploadError(data.error === 'BETA_LIMIT_EXCEEDED' ? 'Limite de 50MB excedido.' : data.error || 'Erro ao enviar.');
        }
      } catch { setUploadError('Resposta inválida do servidor.'); }
    };
    xhr.onerror = () => { setUploading(false); setUploadError('Falha na conexão.'); };
    xhr.send(fd);
  };

  // ─── My Sessions ─────────────────────────────────────────────────────────
  const fetchMySessions = async () => {
    if (!sessionToken) return;
    setMySessionsLoading(true); setMySessionsError(null);
    try {
      const res = await fetch('/api/my-sessions', { headers: { Authorization: `Bearer ${sessionToken}` } });
      if (!res.ok) throw new Error('Falha ao carregar.');
      const data = await res.json();
      setMySessions(Array.isArray(data) ? data : (data.sessions || []));
    } catch (err: any) { setMySessionsError(err.message || 'Erro.'); }
    finally { setMySessionsLoading(false); }
  };

  const handleRevokeSession = async (token: string) => {
    if (!confirm('Apagar esta transferência permanentemente?')) return;
    try {
      const res = await fetch(`/api/session/${token}`, { method: 'DELETE', headers: { Authorization: `Bearer ${sessionToken}` } });
      if (res.ok) { toast.success('Transferência removida.'); fetchMySessions(); }
      else toast.error('Erro ao remover.');
    } catch { toast.error('Erro de conexão.'); }
  };

  const handleCopyUrl = async (token: string, id: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Sessão encerrada.');
    setActiveView('upload');
  };

  const handleAuthSuccess = () => {
    if (pendingUploadAfterLogin) { setPendingUploadAfterLogin(false); setTimeout(doUpload, 500); }
  };

  const handleViewLink = (token: string) => {
    window.open(`${window.location.origin}/s/${token}`, '_blank');
  };

  // ─── RECIPIENT VIEW ───────────────────────────────────────────────────────
  if (isRecipientView) {
    return (
      <div className="min-h-screen bg-[hsl(220_14%_6%)] bg-grid flex flex-col items-center justify-center p-4">
        <Toaster theme="dark" position="top-right" />
        <div className="w-full max-w-md space-y-4 animate-fade-up">
          {/* Brand */}
          <a href="/" className="flex items-center gap-2 mb-6 group w-fit">
            <div className="w-8 h-8 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="font-bold text-white/80 text-sm tracking-tight group-hover:text-white transition-colors">Dropzeo</span>
          </a>

          {recipientLoading ? (
            <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-12 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-sm text-white/40">Carregando arquivos...</p>
            </div>
          ) : passwordRequired ? (
            <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/80">Acesso protegido</p>
                  <p className="text-xs text-white/35">Digite o código numérico para desbloquear</p>
                </div>
              </div>
              {passwordFeedback && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/15 rounded-lg px-3 py-2">{passwordFeedback}</p>}
              <input
                type="number"
                className="input-field text-center text-xl font-mono tracking-widest"
                placeholder="• • • •"
                value={recipientPassword}
                onChange={(e) => setRecipientPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchRecipientSession()}
                maxLength={6}
              />
              <button onClick={fetchRecipientSession} className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[hsl(220_14%_6%)] font-semibold text-sm transition-all cursor-pointer">
                Desbloquear
              </button>
            </div>
          ) : recipientError ? (
            <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-8 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-400/10 border border-red-400/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-sm font-semibold text-white/70">{recipientError.message}</p>
              <a href="/" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">← Voltar ao início</a>
            </div>
          ) : recipientSession ? (
            <div className="rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-white/6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
                      <Package className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/85">{recipientSession.files.length} arquivo{recipientSession.files.length > 1 ? 's' : ''}</p>
                      <p className="text-xs text-white/35">{formatBytes(recipientSession.files.reduce((s, f) => s + f.size_bytes, 0))}</p>
                    </div>
                  </div>
                  <CountdownTimer expiresAt={recipientSession.expires_at} onExpire={() => { setRecipientError({ status: 'EXPIRED', message: 'Link expirado.' }); setRecipientSession(null); }} />
                </div>
                {recipientSession.self_destruct && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/8 border border-amber-400/15">
                    <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-xs text-amber-400/80">Autodestrói após o download</span>
                  </div>
                )}
              </div>

              {/* Files */}
              <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
                {recipientSession.files.map((f) => (
                  <a key={f.id} href={f.download_url} download={f.original_name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] border border-transparent hover:border-white/8 transition-all group cursor-pointer">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-white/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white/70 truncate group-hover:text-white/90 transition-colors">{f.original_name}</p>
                      <p className="text-[10px] text-white/25">{formatBytes(f.size_bytes)}</p>
                    </div>
                    <Download className="w-3.5 h-3.5 text-white/20 group-hover:text-cyan-400 transition-colors shrink-0" />
                  </a>
                ))}
              </div>

              {/* Download all */}
              <div className="p-4 border-t border-white/6">
                <button
                  onClick={handleDownloadAll}
                  disabled={isZipping}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[hsl(220_14%_6%)] font-semibold text-sm transition-all disabled:opacity-60 cursor-pointer"
                >
                  {isZipping ? <><Loader2 className="w-4 h-4 animate-spin" /> Compactando...</> : <><Download className="w-4 h-4" /> {recipientSession.files.length > 1 ? 'Baixar todos (ZIP)' : 'Baixar arquivo'}</>}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ─── MAIN APP ─────────────────────────────────────────────────────────────
  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';
  const userAvatar = user?.user_metadata?.avatar_url;

  return (
    <div className="flex h-screen bg-[hsl(220_14%_6%)] overflow-hidden">
      <Toaster theme="dark" position="top-right" richColors />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onSuccess={handleAuthSuccess} />

      {/* ── Sidebar overlay (mobile) ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed lg:relative inset-y-0 left-0 z-50 w-60 flex flex-col bg-[hsl(220_13%_8%)] border-r border-white/6 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/6">
          <div className="w-8 h-8 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white/90 tracking-tight">Dropzeo</p>
            <p className="text-[10px] text-white/30">by brazeo.ai</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden w-6 h-6 flex items-center justify-center text-white/30 hover:text-white/60 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="px-3 py-2 text-[9px] font-bold text-white/20 uppercase tracking-widest">Principal</p>
          <button
            onClick={() => { setActiveView('upload'); setSidebarOpen(false); }}
            className={`sidebar-item w-full ${activeView === 'upload' ? 'active' : ''}`}
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Enviar Arquivos</span>
          </button>
          <button
            onClick={() => {
              if (!user) { toast.info('Faça login para ver seus links.'); setIsAuthModalOpen(true); return; }
              setActiveView('links'); setSidebarOpen(false);
            }}
            className={`sidebar-item w-full ${activeView === 'links' ? 'active' : ''}`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span>Meus Links</span>
            {!user && <Lock className="w-3 h-3 ml-auto text-white/20" />}
          </button>

          <div className="my-3 border-t border-white/6" />
          <p className="px-3 py-2 text-[9px] font-bold text-white/20 uppercase tracking-widest">Info</p>
          <div className="sidebar-item cursor-default">
            <Globe className="w-4 h-4 shrink-0" />
            <span>Beta público</span>
            <span className="badge badge-cyan ml-auto">Free</span>
          </div>
          <div className="sidebar-item cursor-default">
            <Shield className="w-4 h-4 shrink-0" />
            <span>50MB por link</span>
          </div>
        </nav>

        {/* User area */}
        <div className="p-3 border-t border-white/6">
          {authLoading ? (
            <div className="px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-white/20 animate-spin" />
              <span className="text-xs text-white/25">Carregando...</span>
            </div>
          ) : user ? (
            <div className="space-y-1">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/6">
                {userAvatar ? (
                  <img src={userAvatar} alt="" className="w-7 h-7 rounded-lg object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-cyan-400/15 border border-cyan-400/20 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/75 truncate">{userName}</p>
                  <p className="text-[10px] text-white/30 truncate">{user.email}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="sidebar-item w-full text-red-400/60 hover:text-red-400 hover:bg-red-400/8">
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Sair</span>
              </button>
            </div>
          ) : (
            <button onClick={() => setIsAuthModalOpen(true)} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-sm font-semibold hover:bg-cyan-400/15 transition-all cursor-pointer">
              <User className="w-4 h-4" />
              Entrar / Cadastrar
            </button>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-4 px-5 py-4 border-b border-white/6 bg-[hsl(220_13%_8%)] shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all cursor-pointer">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white/80">
              {activeView === 'upload' ? 'Enviar Arquivos' : 'Meus Links'}
            </h1>
            <p className="text-xs text-white/30 hidden sm:block">
              {activeView === 'upload' ? 'Compartilhe temporariamente com segurança' : 'Histórico de transferências'}
            </p>
          </div>
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-5 lg:p-8">

          {/* ── UPLOAD VIEW ── */}
          {activeView === 'upload' && (
            <div className="max-w-xl mx-auto space-y-5 animate-fade-up">

              {shareResult ? (
                <ShareLink
                  token={shareResult.token}
                  expiresAt={shareResult.expiresAt}
                  onReset={() => { setShareResult(null); setSelectedFiles([]); setSelfDestruct(false); setPassword(''); }}
                />
              ) : (
                <>
                  {/* Upload zone */}
                  <div className="animate-fade-up">
                    <UploadZone onFilesSelected={handleFilesSelected} maxSizeBytes={52428800} totalSizeBytesSelected={totalBytes} />
                  </div>

                  {/* File list */}
                  {selectedFiles.length > 0 && (
                    <div className="animate-fade-up stagger-1">
                      <FileList files={selectedFiles} onRemove={handleRemoveFile} />
                    </div>
                  )}

                  {/* Settings panel */}
                  <div className="rounded-2xl bg-white/[0.02] border border-white/6 overflow-hidden animate-fade-up stagger-2">
                    <div className="px-5 py-3.5 border-b border-white/6 flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-white/25" />
                      <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">Configurações</span>
                    </div>

                    <div className="p-5 space-y-5">
                      {/* Expiration */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-white/30" />
                          <span className="text-xs font-medium text-white/50">Expiração do link</span>
                        </div>
                        <ExpirationSelector value={expiration} onChange={setExpiration} />
                      </div>

                      <div className="border-t border-white/6" />

                      {/* Self destruct */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-white/65">Autodestruição</p>
                          <p className="text-[11px] text-white/30">Apaga após o primeiro download</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelfDestruct(!selfDestruct)}
                          className={`relative w-11 h-6 rounded-full transition-all duration-200 cursor-pointer shrink-0 ${selfDestruct ? 'bg-cyan-400' : 'bg-white/10'}`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${selfDestruct ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>

                      {/* Password */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-3.5 h-3.5 text-white/30" />
                          <span className="text-xs font-medium text-white/50">Senha de acesso <span className="text-white/25">(opcional · 4–6 dígitos)</span></span>
                        </div>
                        <input
                          type="number"
                          className="input-field font-mono tracking-widest text-center"
                          placeholder="Sem senha"
                          value={password}
                          onChange={(e) => setPassword(e.target.value.slice(0, 6))}
                          maxLength={6}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Size indicator */}
                  {totalBytes > 0 && (
                    <div className="animate-fade-up stagger-3 flex items-center justify-between px-1">
                      <span className="text-xs text-white/30">{formatBytes(totalBytes)} de 50 MB</span>
                      <div className="flex-1 mx-4 h-1 bg-white/6 rounded-full overflow-hidden">
                        <div className="h-full progress-bar-fill rounded-full" style={{ width: `${Math.min(100, (totalBytes / 52428800) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-white/20">{Math.round((totalBytes / 52428800) * 100)}%</span>
                    </div>
                  )}

                  {/* Upload progress */}
                  {uploading && (
                    <div className="animate-fade-up rounded-2xl bg-white/[0.02] border border-white/6 p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Enviando...</span>
                        <span className="font-mono text-white/70">{uploadProgress}%</span>
                      </div>
                      <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                        <div className="h-full progress-bar-fill rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-white/25">
                        <span>{uploadSpeed}</span>
                        <span>{uploadEta}</span>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {uploadError && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/15 text-xs text-red-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {uploadError}
                    </div>
                  )}

                  {/* CTA */}
                  <div className="animate-fade-up stagger-4">
                    {!user ? (
                      <div className="rounded-2xl bg-white/[0.02] border border-white/6 p-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                          <Zap className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white/70">Login necessário</p>
                          <p className="text-[11px] text-white/35">Crie uma conta gratuita para enviar arquivos</p>
                        </div>
                        <button onClick={() => setIsAuthModalOpen(true)} className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[hsl(220_14%_6%)] text-xs font-bold transition-all cursor-pointer">
                          Entrar <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleStartUpload}
                        disabled={uploading || selectedFiles.length === 0}
                        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 active:scale-[0.99] text-[hsl(220_14%_6%)] font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer glow-cyan"
                      >
                        {uploading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Enviando {uploadProgress}%</>
                        ) : (
                          <><Upload className="w-4 h-4" /> Gerar Link Temporário</>
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── MY LINKS VIEW ── */}
          {activeView === 'links' && (
            <div className="max-w-2xl mx-auto animate-fade-up">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-bold text-white/85">Suas Transferências</h2>
                  <p className="text-xs text-white/35 mt-0.5">Todos os links ativos e expirados</p>
                </div>
                <button
                  onClick={fetchMySessions}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-xs text-white/40 hover:text-white/70 hover:bg-white/8 transition-all cursor-pointer"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${mySessionsLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>

              {authLoading || mySessionsLoading ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  <p className="text-sm text-white/30">Carregando...</p>
                </div>
              ) : !user ? (
                <div className="flex flex-col items-center gap-4 py-16 rounded-2xl border border-dashed border-white/8">
                  <Lock className="w-8 h-8 text-white/15" />
                  <p className="text-sm text-white/40">Faça login para ver seus links</p>
                  <button onClick={() => setIsAuthModalOpen(true)} className="px-5 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-sm font-semibold hover:bg-cyan-400/15 transition-all cursor-pointer">
                    Entrar
                  </button>
                </div>
              ) : mySessionsError ? (
                <div className="flex flex-col items-center gap-3 py-12 rounded-2xl border border-dashed border-red-500/15">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                  <p className="text-sm text-red-400/70">{mySessionsError}</p>
                </div>
              ) : mySessions.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-16 rounded-2xl border border-dashed border-white/6">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-center">
                    <Link2 className="w-7 h-7 text-white/15" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-white/40">Nenhum link ainda</p>
                    <p className="text-xs text-white/20">Crie sua primeira transferência</p>
                  </div>
                  <button onClick={() => setActiveView('upload')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-xs font-semibold hover:bg-cyan-400/15 transition-all cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Enviar Arquivos
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {mySessions.map((session, i) => {
                    const shareUrl = `${window.location.origin}/s/${session.share_token}`;
                    const isActive = !session.is_expired;
                    const totalSize = (session.files || []).reduce((s: number, f: any) => s + (f.size_bytes || 0), 0);
                    return (
                      <div
                        key={session.id}
                        className="rounded-2xl bg-white/[0.025] border border-white/6 hover:border-white/10 transition-all overflow-hidden animate-fade-up"
                        style={{ animationDelay: `${i * 0.05}s` }}
                      >
                        {/* Top */}
                        <div className="flex items-start gap-4 p-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${isActive ? 'bg-cyan-400/10 border-cyan-400/20' : 'bg-white/[0.03] border-white/8'}`}>
                            <Link2 className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-white/20'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs text-white/50 truncate max-w-[220px]">{shareUrl}</span>
                              <span className={`badge ${isActive ? 'badge-green' : 'badge-red'}`}>
                                <span className={`w-1 h-1 rounded-full ${isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                                {isActive ? 'Ativo' : 'Expirado'}
                              </span>
                            </div>
                            <div className="flex items-center flex-wrap gap-3 mt-1.5 text-[11px] text-white/30">
                              <span>{session.files?.length || 0} arquivo{session.files?.length !== 1 ? 's' : ''}</span>
                              <span className="text-white/15">·</span>
                              <span>{formatBytes(totalSize)}</span>
                              <span className="text-white/15">·</span>
                              <span>{session.download_count || 0} download{session.download_count !== 1 ? 's' : ''}</span>
                              {session.self_destruct && <><span className="text-white/15">·</span><span className="badge badge-amber"><Shield className="w-2.5 h-2.5" />autodestrói</span></>}
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center gap-2 px-4 py-3 border-t border-white/5 bg-white/[0.01]">
                          <span className="text-[10px] text-white/20 flex-1">
                            {new Date(session.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            onClick={() => handleCopyUrl(session.share_token, session.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/8 text-[11px] text-white/40 hover:text-white/70 hover:bg-white/8 transition-all cursor-pointer"
                          >
                            {copiedId === session.id ? <><Check className="w-3 h-3 text-green-400" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
                          </button>
                          <button
                            onClick={() => handleViewLink(session.share_token)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/8 text-[11px] text-white/40 hover:text-white/70 hover:bg-white/8 transition-all cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> Ver
                          </button>
                          <button
                            onClick={() => handleRevokeSession(session.share_token)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/8 border border-red-500/15 text-[11px] text-red-400/60 hover:text-red-400 hover:bg-red-500/12 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Remover
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
