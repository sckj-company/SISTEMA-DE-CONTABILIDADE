import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/api';
import { toast } from 'react-toastify';

const LoginPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const remembered = localStorage.getItem('rememberedUser');
    if (remembered) {
      setFormData((prev) => ({ ...prev, username: remembered }));
      setRememberMe(true);
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.password) {
      setError(
        t(
          'loginUi.fillAllFields',
          'Por favor preencha o utilizador e a palavra-passe.'
        )
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authService.login(formData.username, formData.password);
      if (response.data.success) {
        const userData = response.data.user;
        localStorage.setItem('user', JSON.stringify(userData));
        if (rememberMe) {
          localStorage.setItem('rememberedUser', formData.username);
        } else {
          localStorage.removeItem('rememberedUser');
        }
        window.dispatchEvent(new Event('auth-changed'));
        toast.success(t('login.success'));
        if (typeof onLogin === 'function') {
          onLogin();
        }
        if (userData?.is_admin || userData?.is_superuser || userData?.is_staff) {
          navigate('/admin-gestao');
        } else if (userData?.is_operador_facturas || userData?.papel === 'Operador de Facturação') {
          navigate('/facturas');
        } else {
          navigate('/confronto');
        }
      }
    } catch (err) {
      setError(
        err.response?.status === 401
          ? t('login.errorInvalidCredentials')
          : t('login.errorServer')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '32px 16px',
        position: 'relative',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      {/* Seletor de Idioma Discreto no Canto Superior Direito */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          right: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          zIndex: 10,
        }}
      >
        {[
          { code: 'bi', label: 'PT/中文', title: 'Português / 中文' },
          { code: 'pt', label: 'PT', title: 'Português' },
          { code: 'zh', label: '中文', title: '中文' },
          { code: 'en', label: 'EN', title: 'English' },
        ].map((lang) => {
          const rawLang = (i18n.language || 'bi').toLowerCase();
          const activeCode =
            rawLang === 'bi' || rawLang === 'pt-zh' ? 'bi' : rawLang.substring(0, 2);
          const isActive = activeCode === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => i18n.changeLanguage(lang.code)}
              title={lang.title}
              style={{
                backgroundColor: isActive ? '#2563eb' : '#ffffff',
                color: isActive ? '#ffffff' : '#64748b',
                border: `1px solid ${isActive ? '#2563eb' : '#e2e8f0'}`,
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.color = '#2563eb';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#64748b';
                }
              }}
            >
              {lang.label}
            </button>
          );
        })}
      </div>

      {/* Bloco Central de Autenticação */}
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          margin: 'auto 0',
        }}
      >
        {/* Ícone / Logótipo Central Minimalista */}
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            overflow: 'hidden',
            boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
            border: '1px solid #1e293b',
          }}
        >
          <img
            src="/logo.jpeg"
            alt="SCKJ"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>

        {/* Título & Subtítulo */}
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#0f172a',
            margin: '0 0 6px 0',
            textAlign: 'center',
            letterSpacing: '-0.02em',
          }}
        >
          {t('login.systemName', 'SCKJ Contabilidade')}
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: '#64748b',
            margin: '0 0 28px 0',
            textAlign: 'center',
          }}
        >
          {t('login.subtitle', 'Use a sua conta para aceder ao sistema')}
        </p>

        {/* Mensagem de Erro */}
        {error && (
          <div
            style={{
              width: '100%',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              marginBottom: 16,
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          >
            {error}
          </div>
        )}

        {/* Formulário de Credenciais */}
        <form onSubmit={handleSubmit} noValidate style={{ width: '100%' }}>
          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="username"
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#334155',
                marginBottom: 6,
              }}
            >
              {t('login.emailPlaceholder', 'Utilizador ou E-mail')}
            </label>
            <input
              type="text"
              id="username"
              name="username"
              placeholder={t('login.emailPlaceholder', 'Utilizador ou E-mail')}
              value={formData.username}
              onChange={handleChange}
              required
              autoComplete="username"
              style={{
                width: '100%',
                height: 44,
                padding: '0 14px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: 14,
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2563eb';
                e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="password-field"
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: '#334155',
                marginBottom: 6,
              }}
            >
              {t('login.passwordPlaceholder', 'Palavra-passe')}
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password-field"
                name="password"
                placeholder={t('login.passwordPlaceholder', 'Palavra-passe')}
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  height: 44,
                  padding: '0 40px 0 14px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  fontSize: 14,
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? 'Ocultar' : 'Mostrar'}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <i
                  className={`la ${showPassword ? 'la-eye-slash' : 'la-eye'}`}
                  style={{ fontSize: 18 }}
                />
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
              fontSize: 13,
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                color: '#475569',
                margin: 0,
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: '#2563eb',
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
              />
              <span>{t('login.rememberMe', 'Lembrar-me')}</span>
            </label>

            <a
              href="#forget"
              onClick={(e) => {
                e.preventDefault();
                toast.info(
                  t(
                    'loginUi.forgotPasswordToast',
                    'Contacte o suporte da SCKJ para redefinir as suas credenciais.'
                  )
                );
              }}
              style={{
                color: '#2563eb',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              {t('login.forgotPassword', 'Esqueceu a senha?')}
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 8,
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background-color 0.15s ease',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#1d4ed8';
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = '#2563eb';
            }}
          >
            {loading ? (
              <>
                <i className="la la-spinner fa-spin" style={{ fontSize: 16 }} />
                <span>{t('login.submitting', 'Entrando...')}</span>
              </>
            ) : (
              <span>{t('login.submit', 'Entrar')}</span>
            )}
          </button>
        </form>

        {/* Link para Falar com Administrador */}
        <p
          style={{
            fontSize: 13,
            color: '#64748b',
            textAlign: 'center',
            marginTop: 24,
            marginBottom: 0,
          }}
        >
          {t('login.noAccount', 'Não tem uma conta?')}{' '}
          <a
            href="#admin"
            onClick={(e) => {
              e.preventDefault();
              toast.info(
                t(
                  'loginUi.contactAdminToast',
                  'Por favor contacte o Administrador da sua organização ou o Suporte Técnico da SCKJ.'
                )
              );
            }}
            style={{
              color: '#2563eb',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {t('login.contactAdmin', 'Fale com o administrador')}
          </a>
        </p>

        {/* Rodapé Minimalista: Sobre a Empresa & Suporte */}
        <div
          style={{
            marginTop: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            fontSize: 12,
            color: '#94a3b8',
            flexWrap: 'wrap',
          }}
        >
          <a
            href="/sobre"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#64748b',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#64748b';
            }}
          >
            {t('login.aboutUs', 'Sobre a SCKJ')}
          </a>
          <span>•</span>
          <a
            href="/sobre#suporte"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#64748b',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#64748b';
            }}
          >
            {t('login.techSupport', 'Suporte Técnico')}
          </a>
          <span>•</span>
          <span>© 2026 SCKJ</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
