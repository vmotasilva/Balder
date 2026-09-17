import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, Shield, UserPlus, ArrowRight, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    if (mode === 'LOGIN') {
      const res = await loginWithEmail(email, password);
      if (!res.success) {
        setErrorMsg(res.error || 'Erro ao fazer login.');
      }
    } else {
      if (!name) {
        setErrorMsg('Por favor informe seu nome.');
        setIsSubmitting(false);
        return;
      }
      const res = await registerWithEmail(email, password, name);
      if (!res.success) {
        setErrorMsg(res.error || 'Erro ao criar conta.');
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="login-screen-wrapper">
      <div className="login-background-glow"></div>
      
      <div className="login-card-container">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="login-logo-glow">
            <span className="login-brand-icon">ᛒ</span>
          </div>
          <h1 className="login-brand-title">BALDER</h1>
          <p className="login-brand-subtitle">Controle & Estratégia Financeira Pessoal</p>
        </div>

        {/* Security badge */}
        <div className="login-security-badge">
          <Shield size={14} className="security-icon" />
          <span>Multi-tenant Isolado • Dados Criptografados no Appwrite</span>
        </div>

        {/* Primary Action: Google OAuth */}
        <div className="login-oauth-section">
          <button 
            type="button" 
            className="btn-google-oauth"
            onClick={loginWithGoogle}
          >
            <svg className="google-svg" viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continuar com o Google</span>
          </button>
        </div>

        <div className="login-divider">
          <span>ou acesse via email</span>
        </div>

        {/* Email / Password Form */}
        <form onSubmit={handleSubmit} className="login-email-form">
          {errorMsg && (
            <div className="login-error-alert">
              {errorMsg}
            </div>
          )}

          {mode === 'REGISTER' && (
            <div className="login-input-group">
              <label>Nome Completo</label>
              <input 
                type="text" 
                placeholder="Seu nome"
                value={name} 
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="login-input-group">
            <label>E-mail</label>
            <input 
              type="email" 
              placeholder="exemplo@balder.app"
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login-input-group">
            <label>Senha</label>
            <input 
              type="password" 
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <button 
            type="submit" 
            className="btn-submit-credentials"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span>Processando...</span>
            ) : mode === 'LOGIN' ? (
              <>
                <LogIn size={18} />
                <span>Entrar no Balder</span>
              </>
            ) : (
              <>
                <UserPlus size={18} />
                <span>Criar Conta</span>
              </>
            )}
          </button>
        </form>

        {/* Mode Switcher */}
        <div className="login-switch-mode">
          {mode === 'LOGIN' ? (
            <button 
              type="button" 
              className="btn-text-switch"
              onClick={() => { setMode('REGISTER'); setErrorMsg(''); }}
            >
              Não tem uma conta? <strong>Cadastre-se no Appwrite</strong>
            </button>
          ) : (
            <button 
              type="button" 
              className="btn-text-switch"
              onClick={() => { setMode('LOGIN'); setErrorMsg(''); }}
            >
              Já possui conta? <strong>Fazer login</strong>
            </button>
          )}
        </div>

        {/* Quick Demo Bypass */}
        <div className="login-demo-bypass">
          <button 
            type="button" 
            className="btn-demo-quick-access"
            onClick={continueAsGuest}
            title="Acessa o sistema instantaneamente para testes locais"
          >
            <Sparkles size={16} />
            <span>Explorar em Modo Demonstração (Local)</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
