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
        onLogin();
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
    <main className="main-content">
      <div className="signUP-admin">
        <div className="container-fluid">
          <div className="row justify-content-center">
            <div className="col-xl-4 col-lg-5 col-md-5 p-0">
              <div className="signUP-admin-left signIn-admin-left position-relative">
                <div className="signUP-admin-left__content">
                  <div className="text-capitalize mb-md-30 mb-15 d-flex align-items-center justify-content-md-start justify-content-center">
                    <img
                      src="/logo.jpeg"
                      alt="SCKJ"
                      style={{ height: 44, width: 'auto', marginRight: 12 }}
                    />
                  </div>
                  <h1>{t('login.systemName')}</h1>
                  <p className="mt-15 text-muted" style={{ fontSize: 15, lineHeight: 1.6 }}>
                    {t('login.systemDescription')}
                  </p>
                </div>
                <div className="signUP-admin-left__img">
                  <img
                    className="img-fluid svg"
                    src="/template/img/svg/signupIllustration.svg"
                    alt="img"
                  />
                </div>
              </div>
            </div>

            <div className="col-xl-8 col-lg-7 col-md-7 col-sm-8 d-flex flex-column justify-content-center align-items-center py-4" style={{ minHeight: '100vh' }}>
              <div className="signUp-admin-right signIn-admin-right w-100 p-0 d-flex flex-column align-items-center justify-content-center" style={{ maxWidth: 520, marginTop: 15 }}>
                <div className="w-100">
                  <div className="edit-profile">
                    <div
                      className="card border-0"
                      style={{
                        borderRadius: 16,
                        boxShadow: '0 10px 35px -5px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.85)',
                        background: '#ffffff',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        className="d-flex justify-content-end align-items-center px-20 pt-15 flex-wrap"
                        style={{ background: '#ffffff', gap: 6 }}
                      >
                        {[
                          { code: 'bi', label: 'PT/中文', title: 'Português / 中文' },
                          { code: 'pt', label: 'PT', title: 'Português' },
                          { code: 'zh', label: '中文', title: '中文' },
                          { code: 'en', label: 'EN', title: 'English' },
                        ].map((lang) => {
                          const rawLang = (i18n.language || 'pt').toLowerCase();
                          const activeCode = rawLang === 'bi' || rawLang === 'pt-zh' ? 'bi' : rawLang.substring(0, 2);
                          const isActive = activeCode === lang.code;
                          return (
                            <button
                              key={lang.code}
                              type="button"
                              onClick={() => i18n.changeLanguage(lang.code)}
                              title={lang.title}
                              style={{
                                background: isActive ? '#2563eb' : '#ffffff',
                                color: isActive ? '#ffffff' : '#2563eb',
                                border: '1px solid #2563eb',
                                borderRadius: 6,
                                padding: '3px 10px',
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                lineHeight: 1.4,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {lang.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="card-header border-0 pb-md-15 pb-10 pt-10 text-center" style={{ background: '#ffffff' }}>
                        <div className="edit-profile__title w-100">
                          <h4 className="fw-700 mb-2" style={{ color: '#0f172a' }}>
                            {t('login.title', 'Iniciar Sessão')}
                          </h4>
                          <span className="color-primary fw-600 d-block" style={{ fontSize: '14.5px', lineHeight: 1.4 }}>
                            {t('login.systemName', 'Sistema de Reconciliação Contabilística e Fiscal')}
                          </span>
                        </div>
                      </div>
                      <div className="card-body pt-0" style={{ background: '#ffffff' }}>
                        <div className="edit-profile__body">
                          <p className="text-muted mb-25 text-center" style={{ fontSize: 13.5 }}>
                            {t('login.subtitle', 'Use a sua conta para aceder ao sistema')}
                          </p>

                          {error && (
                            <div className="alert alert-danger" role="alert">
                              {error}
                            </div>
                          )}

                          <form onSubmit={handleSubmit} noValidate>
                            <div className="form-group mb-20">
                              <label htmlFor="username" className="fw-500 mb-1">{t('login.emailPlaceholder')}</label>
                              <input
                                type="text"
                                className="form-control"
                                id="username"
                                name="username"
                                placeholder={t('login.emailPlaceholder')}
                                value={formData.username}
                                onChange={handleChange}
                                required
                                autoComplete="username"
                                style={{ borderRadius: 8, height: 46 }}
                              />
                            </div>

                            <div className="form-group mb-15">
                              <label htmlFor="password-field" className="fw-500 mb-1">
                                {t('login.passwordPlaceholder')}
                              </label>
                              <div className="position-relative">
                                <input
                                  id="password-field"
                                  type={showPassword ? 'text' : 'password'}
                                  className="form-control"
                                  name="password"
                                  placeholder={t('login.passwordPlaceholder')}
                                  value={formData.password}
                                  onChange={handleChange}
                                  required
                                  autoComplete="current-password"
                                  style={{ borderRadius: 8, height: 46 }}
                                />
                                <i
                                  className={`la la-fw ${
                                    showPassword ? 'la-eye-slash' : 'la-eye'
                                  } text-light fs-16 field-icon toggle-password2`}
                                  style={{ cursor: 'pointer', top: '50%', transform: 'translateY(-50%)' }}
                                  onClick={() => setShowPassword((prev) => !prev)}
                                ></i>
                              </div>
                            </div>

                            <div className="signUp-condition signIn-condition d-flex justify-content-between align-items-center mb-20">
                              <div className="checkbox-theme-default custom-checkbox">
                                <input
                                  className="checkbox"
                                  type="checkbox"
                                  id="check-remember"
                                  checked={rememberMe}
                                  onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <label htmlFor="check-remember">
                                  <span className="checkbox-text">{t('login.rememberMe')}</span>
                                </label>
                              </div>
                              <a
                                href="#forget"
                                className="fs-13 text-primary"
                                onClick={(e) => {
                                  e.preventDefault();
                                  toast.info(
                                    t(
                                      'loginUi.forgotPasswordToast',
                                      'Contacte o suporte da SCKJ para redefinir as suas credenciais.'
                                    )
                                  );
                                }}
                              >
                                {t('login.forgotPassword')}
                              </a>
                            </div>

                            <div className="button-group d-flex pt-1 justify-content-center">
                              <button
                                type="submit"
                                className="btn btn-primary btn-default btn-squared text-capitalize lh-normal w-100 py-12 signIn-createBtn"
                                disabled={loading}
                                style={{ borderRadius: 8, fontSize: 15, fontWeight: 600 }}
                              >
                                {loading ? (
                                  <>
                                    <i className="la la-spinner fa-spin mr-10"></i>
                                    {t('login.submitting')}
                                  </>
                                ) : (
                                  t('login.submit')
                                )}
                              </button>
                            </div>
                          </form>

                          <p className="text-center mt-25 mb-0 text-muted" style={{ fontSize: 13 }}>
                            {t('login.noAccount')}{' '}
                            <a
                              href="#admin"
                              className="color-primary fw-600"
                              onClick={(e) => {
                                e.preventDefault();
                                toast.info(
                                  t(
                                    'loginUi.contactAdminToast',
                                    'Por favor contacte o Administrador da sua organização ou o Suporte Técnico da SCKJ.'
                                  )
                                );
                              }}
                            >
                              {t('login.contactAdmin')}
                            </a>
                          </p>

                          {/* Links Oficiais: Sobre Nós e Suporte Técnico */}
                          <div className="pt-20 mt-25 border-top text-center">
                            <div className="d-flex justify-content-center align-items-center flex-wrap" style={{ gap: 10 }}>
                              <a
                                href="/sobre"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline-primary fw-600 fs-13 px-3 py-2 rounded-pill d-inline-flex align-items-center"
                                style={{ background: '#ffffff', transition: 'all 0.2s' }}
                                title={t(
                                  'loginUi.aboutUsTitle',
                                  'Conheça a história e estrutura da SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA'
                                )}
                              >
                                <i className="la la-building mr-1 fs-16"></i>
                                {t('login.aboutUs', 'Sobre a SCKJ')}
                              </a>
                              <a
                                href="/sobre#suporte"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline-primary fw-600 fs-13 px-3 py-2 rounded-pill d-inline-flex align-items-center"
                                style={{ background: '#ffffff', transition: 'all 0.2s' }}
                                title={t(
                                  'loginUi.techSupportTitle',
                                  'Canais Oficiais de Suporte Técnico e Atendimento'
                                )}
                              >
                                <i className="la la-headset mr-1 fs-16"></i>
                                {t('login.techSupport', 'Suporte Técnico')}
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé institucional logo abaixo do cartão */}
                  <div className="text-center mt-25 mb-10">
                    <p className="text-muted mb-1" style={{ fontSize: 12.5 }}>
                      © 2026 <strong>SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA</strong> • {t('loginUi.nifLabel', 'NIF')}: 5002830280
                    </p>
                    <div className="d-flex justify-content-center align-items-center gap-3">
                      <a
                        href="/sobre"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary fs-12 fw-500"
                      >
                        {t('loginUi.companyPresentation', 'Apresentação da Empresa')}
                      </a>
                      <span className="text-muted fs-12">•</span>
                      <a
                        href="/sobre#suporte"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary fs-12 fw-500"
                      >
                        {t('loginUi.serviceChannels', 'Canais de Atendimento')}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
