import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, ArrowRight, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, continueAsGuest } = useAuth();

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
          <span>Multi-tenant Isolado • Dados Criptografados no Supabase (RLS)</span>
        </div>

        {/* OAuth Authentication Section */}
        <div className="login-oauth-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '1.5rem' }}>
          {/* Primary Action: Google OAuth */}
          <button 
            type="button" 
            className="btn-google-oauth"
            onClick={loginWithGoogle}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <svg className="google-svg" viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span style={{ fontWeight: 600 }}>Continuar com o Google</span>
          </button>

          {/* Secondary: Apple (Coming Soon) */}
          <button 
            type="button" 
            className="btn-google-oauth"
            disabled
            style={{ 
              width: '100%', 
              justifyContent: 'center', 
              opacity: 0.5, 
              cursor: 'not-allowed',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8'
            }}
            title="Integração Apple em breve"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.93-2.85-.9.04-2 .6-2.65 1.35-.58.66-1.09 1.73-.95 2.76 1.01.08 2.05-.51 2.67-1.26z"/>
            </svg>
            <span>Continuar com Apple</span>
            <span style={{ fontSize: '10px', background: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: '10px', marginLeft: 'auto' }}>Em breve</span>
          </button>

          {/* Secondary: Microsoft (Coming Soon) */}
          <button 
            type="button" 
            className="btn-google-oauth"
            disabled
            style={{ 
              width: '100%', 
              justifyContent: 'center', 
              opacity: 0.5, 
              cursor: 'not-allowed',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8'
            }}
            title="Integração Microsoft em breve"
          >
            <svg viewBox="0 0 23 23" width="18" height="18">
              <path fill="#f35325" d="M1 1h10v10H1z"/>
              <path fill="#81bc06" d="M12 1h10v10H12z"/>
              <path fill="#05a6f0" d="M1 12h10v10H1z"/>
              <path fill="#ffba08" d="M12 12h10v10H12z"/>
            </svg>
            <span>Continuar com Microsoft</span>
            <span style={{ fontSize: '10px', background: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: '10px', marginLeft: 'auto' }}>Em breve</span>
          </button>
        </div>

        <div className="login-divider" style={{ margin: '1.5rem 0 1rem' }}>
          <span>ou</span>
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
