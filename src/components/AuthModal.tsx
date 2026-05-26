import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { X, Mail, Lock, Shield, Loader2, ArrowRight, User } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
}

export default function AuthModal({ isOpen, onClose, onSuccess, title }: AuthModalProps) {
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
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
              full_name: name,
              avatar_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name || email)}`
            }
          }
        });

        if (error) throw error;

        // Call our server endpoint to trigger welcome email sending / logging
        try {
          await fetch('/api/welcome-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name })
          });
        } catch (emailErr) {
          console.error('Failed to call welcome-email endpoint:', emailErr);
        }

        // Auto sign-in or check email notice
        if (data.session) {
          setMessage({ type: 'success', text: `Conta criada com sucesso! Seja bem-vindo(a), ${name}!` });
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
        } else {
          setMessage({
            type: 'success',
            text: `Cadastro realizado, ${name}! Enviamos um e-mail dando boas-vindas para você.`,
          });
        }
      } else {
        // Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setMessage({ type: 'success', text: 'Login efetuado com sucesso!' });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1000); // Friendly visual feedback
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      // Friendly Brazilian Portuguese error messages
      let errorMsg = err.message || 'Ocorreu um erro na autenticação.';
      if (err.message?.includes('Invalid login credentials') || err.message?.includes('invalid claim')) {
        errorMsg = 'E-mail ou senha incorretos.';
      } else if (err.message?.includes('already registered')) {
        errorMsg = 'Este e-mail já está cadastrado.';
      } else if (err.message?.includes('Password should be')) {
        errorMsg = 'A senha deve conter no mínimo 6 caracteres.';
      }
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md overflow-hidden bg-card border border-border rounded-xl p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {isSignUp ? 'Criar Conta' : 'Entrar no Dropzeo'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {title || 'Faça login para gerenciar e enviar arquivos maiores'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted rounded-md"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auth form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5" htmlFor="name-input">
                Seu Nome Completo
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="name-input"
                  type="text"
                  required={isSignUp}
                  className="w-full bg-background border border-border rounded-lg py-2.5 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:border-primary transition-all"
                  placeholder="Seu nome ou apelido"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5" htmlFor="email-input">
              Endereço de E-mail
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <Mail className="w-4 h-4" />
              </span>
              <input
                id="email-input"
                type="email"
                required
                className="w-full bg-background border border-border rounded-lg py-2.5 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:border-primary transition-all"
                placeholder="nome@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5" htmlFor="password-input">
              Senha
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="password-input"
                type="password"
                required
                className="w-full bg-background border border-border rounded-lg py-2.5 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:border-primary transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-xs leading-relaxed ${
              message.type === 'success' ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}>
              {message.text}
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-2.5 px-4 rounded-lg font-medium text-sm transition-all focus:ring-2 focus:ring-primary/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'Criar minha conta' : 'Entrar na minha conta'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer toggler */}
        <div className="mt-6 pt-4 border-t border-border text-center text-xs">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage(null);
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {isSignUp ? 'Já tem uma conta? Faça Login' : 'Não tem uma conta ainda? Cadastre-se'}
          </button>
        </div>

      </div>
    </div>
  );
}
