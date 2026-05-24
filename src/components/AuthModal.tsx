import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { X, Mail, Lock, User, ArrowRight, Loader2, Sparkles } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name, full_name: name, avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name || email)}` } }
        });
        if (error) throw error;
        try { await fetch('/api/welcome-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name }) }); } catch {}
        if (data.session) {
          setMessage({ type: 'success', text: `Bem-vindo(a), ${name}!` });
          setTimeout(() => { onSuccess(); onClose(); }, 1000);
        } else {
          setMessage({ type: 'success', text: 'Confirme seu e-mail para continuar.' });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro de autenticação.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm rounded-2xl bg-[hsl(220_13%_9%)] border border-white/8 shadow-2xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/90">{isSignUp ? 'Criar conta' : 'Entrar'}</h2>
              <p className="text-[11px] text-white/35">Dropzeo · acesso gratuito</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-all cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {isSignUp && (
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
              <input className="input-field pl-9" type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <input className="input-field pl-9" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <input className="input-field pl-9" type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {message && (
            <div className={`px-3 py-2.5 rounded-lg text-xs ${message.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[hsl(220_14%_6%)] font-semibold text-sm transition-all disabled:opacity-50 cursor-pointer mt-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>{isSignUp ? 'Criar conta' : 'Entrar'}</span><ArrowRight className="w-4 h-4" /></>}
          </button>

          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }}
            className="w-full text-center text-xs text-white/30 hover:text-white/55 transition-colors py-1 cursor-pointer"
          >
            {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Criar grátis'}
          </button>
        </form>
      </div>
    </div>
  );
}
