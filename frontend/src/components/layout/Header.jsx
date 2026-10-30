import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { menuItems } from './menuConfig';
import { usePeriodo } from '../../context/PeriodoContext';

const languages = [
  { code: 'bi', short: 'PT/中文', label: 'Português / 中文', flag: '/china_flag.png' },
  { code: 'pt', short: 'PT', label: 'Português', flag: '/angola_flag.png' },
  { code: 'zh', short: '中文', label: '中文 (Chinês)', flag: '/china_flag.png' },
  { code: 'en', short: 'EN', label: 'English', flag: '/template/img/eng.png' },
];

const Header = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [openMenu, setOpenMenu] = useState(null);
  const navRef = useRef(null);
  const { empresaAtual, empresas, atualizar } = usePeriodo() || {};

  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const isAdmin = Boolean(user.is_admin || user.is_superuser || user.is_staff);
  const nomeExibido = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.nome || t('headerUi.defaultUser', 'Utilizador');
  const initial = (user.first_name || user.username || user.nome || 'U').charAt(0).toUpperCase();

  const traduzirPapel = (papelBruto) => {
    const mapa = {
      'Super Administrador': t('headerUi.roleSuperAdmin', 'Super Administrador'),
      'Super Admin': t('headerUi.roleSuperAdminShort', 'Super Admin'),
      'Administrador': t('headerUi.roleAdmin', 'Administrador'),
      'Contabilista': t('headerUi.roleAccountant', 'Contabilista'),
      'Operador de Facturação': t('headerUi.roleInvoiceOperator', 'Operador de Facturação'),
      'Auditor': t('headerUi.roleAuditor', 'Auditor'),
      'Fiscalista': t('headerUi.roleTaxSpecialist', 'Fiscalista'),
      'Consulta': t('headerUi.roleReadOnly', 'Consulta'),
    };
    return mapa[papelBruto] || papelBruto;
  };

  useEffect(() => {
    const syncUser = () => {
      try {
        setUser(JSON.parse(localStorage.getItem('user') || '{}'));
      } catch {
        setUser({});
      }
    };
    window.addEventListener('auth-changed', syncUser);
    window.addEventListener('storage', syncUser);
    return () => {
      window.removeEventListener('auth-changed', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  const rawLang = (i18n.language || 'pt').toLowerCase();
  const activeLangCode = rawLang === 'bi' || rawLang === 'pt-zh' ? 'bi' : rawLang.substring(0, 2);
  const currentLang =
    languages.find((l) => l.code === activeLangCode) || languages[1];

  const matchedItem = menuItems.find((item) => item.path === location.pathname);
  const pageTitle = matchedItem
    ? t(matchedItem.textKey, matchedItem.fallbackText || matchedItem.text)
    : t('navigation.home', 'Painel de Confronto');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('periodoAuditoria');
    window.dispatchEvent(new Event('auth-changed'));
    navigate('/login');
  };

  return (
    <header className="header-top">
      <nav className="navbar navbar-light">
        <div className="navbar-left">
          <a
            href="#sidebar"
            className="sidebar-toggle"
            onClick={(e) => {
              e.preventDefault();
              onToggleSidebar();
            }}
          >
            <i className="la la-bars"></i>
          </a>
          <a className="navbar-brand" href="#home" onClick={(e) => e.preventDefault()}>
            <img src="/logo.jpeg" alt="SCKJ" style={{ height: 34, width: 'auto' }} />
            <span className="d-none d-xl-inline-block ml-2 text-capitalize color-primary fw-600">
              {pageTitle}
            </span>
          </a>
        </div>

        <div className="navbar-right" ref={navRef}>
          <ul className="navbar-right__menu">
            {/* EMPRESA ATIVA IDENTIFICADA NO TOPO */}
            {(() => {
              const empresaExibida = empresaAtual || (empresas && empresas.length > 0 ? empresas[0] : null);
              const podeTrocarEmpresa = Boolean(isAdmin && empresas && empresas.length > 1);

              return (
                <li className="nav-empresa mr-15">
                  <div className={`dropdown-custom ${openMenu === 'empresa' ? 'show' : ''}`}>
                    <button
                      type="button"
                      className="btn-empresa-header btn btn-sm d-flex align-items-center"
                      onClick={(e) => {
                        e.preventDefault();
                        if (podeTrocarEmpresa) {
                          setOpenMenu(openMenu === 'empresa' ? null : 'empresa');
                        }
                      }}
                      style={{
                        background: '#ffffff',
                        border: '1px solid ' + (empresaExibida ? '#bfdbfe' : '#e2e8f0'),
                        borderRadius: 20,
                        padding: '5px 14px',
                        minHeight: 42,
                        height: 'auto',
                        gap: 10,
                        cursor: podeTrocarEmpresa ? 'pointer' : 'default',
                        flexShrink: 0,
                      }}
                      title={
                        empresaExibida
                          ? `${empresaExibida.nome} (NIF: ${empresaExibida.nif})`
                          : t('headerUi.noCompanySelected', 'Nenhuma empresa selecionada')
                      }
                    >
                      <span
                        className="empresa-avatar-icon"
                        style={{
                          width: 26,
                          height: 26,
                          minWidth: 26,
                          minHeight: 26,
                          borderRadius: '50%',
                          background: empresaExibida ? '#2563eb' : '#94a3b8',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          flexShrink: 0,
                        }}
                      >
                        <i className="la la-building"></i>
                      </span>
                      <div className="d-flex flex-column text-left" style={{ lineHeight: 1.25 }}>
                        <span
                          className="fw-700 text-truncate"
                          style={{ fontSize: 12, maxWidth: 300, color: empresaExibida ? '#0f172a' : '#64748b', display: 'block' }}
                        >
                          {empresaExibida ? empresaExibida.nome : t('headerUi.noActiveCompany', 'Sem Empresa Ativa')}
                        </span>
                        <span className="text-muted" style={{ fontSize: 10.5, display: 'block' }}>
                          {empresaExibida
                            ? `NIF: ${empresaExibida.nif}`
                            : podeTrocarEmpresa
                            ? t('headerUi.clickToSelect', 'Clique para selecionar')
                            : t('headerUi.awaitingAssignment', 'Aguardando atribuição')}
                        </span>
                      </div>
                      {podeTrocarEmpresa && (
                        <i className="la la-angle-down text-muted ml-4" style={{ fontSize: 11, flexShrink: 0 }}></i>
                      )}
                    </button>

                    {podeTrocarEmpresa && (
                      <div
                        className="dropdown-wrapper dropdown-wrapper--medium p-10"
                        style={{
                          minWidth: 280,
                          maxHeight: 340,
                          overflowY: 'auto',
                          right: 0,
                          left: 'auto',
                        }}
                      >
                        <div className="dropdown-header px-10 py-5 text-muted fw-700" style={{ fontSize: 11 }}>
                          {t('headerUi.availableCompanies', 'EMPRESAS DISPONÍVEIS')} ({empresas.length})
                        </div>
                        {empresas.map((emp) => {
                          const ativa = String(emp.id) === String(empresaExibida?.id);
                          return (
                            <a
                              key={emp.id}
                              href="#select-empresa"
                              className={`dropdown-item px-10 py-8 d-flex align-items-center justify-content-between rounded mb-2 ${
                                ativa ? 'bg-primary-lighten text-primary fw-700' : ''
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                if (atualizar) atualizar({ empresaId: String(emp.id) });
                                setOpenMenu(null);
                              }}
                              style={{ gap: 8, fontSize: 12 }}
                            >
                              <div className="d-flex flex-column text-truncate">
                                <span className="text-truncate">{emp.nome}</span>
                                <small className="text-muted" style={{ fontSize: 10.5 }}>
                                  NIF: {emp.nif} {emp.provincia ? `• ${emp.provincia}` : ''}
                                </small>
                              </div>
                              {ativa && <i className="la la-check text-primary fw-700" style={{ fontSize: 15 }}></i>}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </li>
              );
            })()}

            {isAdmin && (
              <li className="d-none d-md-inline-block mr-15">
                <button
                  type="button"
                  className={`btn btn-xs ${location.pathname === '/admin-gestao' ? 'btn-primary text-white' : 'btn-outline-primary'}`}
                  onClick={() => navigate('/admin-gestao')}
                  style={{
                    borderRadius: 20,
                    fontSize: 11.5,
                    padding: '4px 12px',
                    fontWeight: 600,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  title={t('navigation.admin', 'Administração Global')}
                >
                  <i className="la la-sliders-h"></i> {t('headerUi.managementPanel', 'Painel de Gestão')}
                </button>
              </li>
            )}
            <li className="nav-flag-select">
              <div className={`dropdown-custom ${openMenu === 'lang' ? 'show' : ''}`}>
                <a
                  href="#language"
                  className="nav-item-toggle d-flex align-items-center justify-content-center"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenMenu(openMenu === 'lang' ? null : 'lang');
                  }}
                  title={
                    currentLang.code === 'bi'
                      ? t('headerUi.langBilingual', 'Português / 中文 (Bilingue)')
                      : currentLang.code === 'zh'
                      ? t('headerUi.langChinese', '中文 (Chinês)')
                      : currentLang.label
                  }
                  style={{
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 18,
                    border: '1px solid #bfdbfe',
                    backgroundColor: '#ffffff',
                    color: '#2563eb',
                    fontSize: 11.5,
                    fontWeight: 700,
                    gap: 6,
                    flexShrink: 0,
                    textDecoration: 'none',
                  }}
                >
                  <img
                    src={currentLang.flag}
                    alt=""
                    aria-label={currentLang.label}
                    className="rounded-circle"
                    style={{ width: 18, height: 18, minWidth: 18, minHeight: 18, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <span>{currentLang.short}</span>
                </a>
                <div className="dropdown-wrapper dropdown-wrapper--small" style={{ minWidth: 190 }}>
                  {languages.map((lang) => (
                    <a
                      key={lang.code}
                      href="#lang"
                      onClick={(e) => {
                        e.preventDefault();
                        i18n.changeLanguage(lang.code);
                        setOpenMenu(null);
                      }}
                      className={activeLangCode === lang.code ? 'active' : ''}
                    >
                      <img
                        src={lang.flag}
                        alt=""
                        style={{ width: 18, height: 18, objectFit: 'cover', borderRadius: '50%' }}
                      />{' '}
                      {lang.code === 'bi'
                        ? t('headerUi.langBilingual', 'Português / 中文 (Bilingue)')
                        : lang.code === 'zh'
                        ? t('headerUi.langChinese', '中文 (Chinês)')
                        : lang.label}
                    </a>
                  ))}
                </div>
              </div>
            </li>

            <li className="nav-author">
              <div className={`dropdown-custom ${openMenu === 'author' ? 'show' : ''}`}>
                <a
                  href="#author"
                  className="nav-item-toggle d-flex align-items-center justify-content-center"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpenMenu(openMenu === 'author' ? null : 'author');
                  }}
                  style={{ width: 34, height: 34, flexShrink: 0 }}
                >
                  <span className="author-initials">{initial}</span>
                </a>
                <div className="dropdown-wrapper">
                  <div className="nav-author__info">
                    <div className="author-img">
                      <span className="author-initials">{initial}</span>
                    </div>
                    <div>
                      <h6>{nomeExibido}</h6>
                      {user.username && nomeExibido !== user.username && (
                        <small className="text-muted d-block mb-1" style={{ fontSize: 11 }}>
                          @{user.username}
                        </small>
                      )}
                      <span className="badge px-6 py-2" style={{ fontSize: 11, fontWeight: 700, background: '#ffffff', border: '1px solid #bfdbfe', color: '#2563eb' }}>
                        {traduzirPapel(user.papel || user.perfil || (isAdmin ? 'Administrador' : 'Contabilista'))}
                      </span>
                    </div>
                  </div>
                  <div className="nav-author__options">
                    <ul>
                      {isAdmin && (
                        <li>
                          <a
                            href="#admin"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate('/admin-gestao');
                            }}
                            style={{ color: '#2563eb', fontWeight: 700 }}
                          >
                            <i className="la la-shield-alt" style={{ color: '#2563eb' }}></i>{' '}
                            {t('navigation.admin', 'Administração Global')}
                          </a>
                        </li>
                      )}
                      <li>
                        <a
                          href="#perfil"
                          onClick={(e) => {
                            e.preventDefault();
                            navigate('/perfil');
                          }}
                        >
                          <i className="la la-user-lock"></i> {t('navigation.profile', 'O Meu Perfil & Senha')}
                        </a>
                      </li>
                      {(user.is_operador_facturas || user.papel === 'Operador de Facturação') ? (
                        <li>
                          <a
                            href="#facturas"
                            onClick={(e) => {
                              e.preventDefault();
                              navigate('/facturas');
                            }}
                          >
                            <i className="la la-file-invoice-dollar text-primary"></i>{' '}
                            {t('headerUi.scannerPortal', 'Portal do Scanner (Facturas)')}
                          </a>
                        </li>
                      ) : (
                        <>
                          <li>
                            <a
                              href="#documentos"
                              onClick={(e) => {
                                e.preventDefault();
                                navigate('/arquivo');
                              }}
                            >
                              <i className="la la-folder-open"></i>{' '}
                              {t('navigation.documents', 'Arquivo de Documentos')}
                            </a>
                          </li>
                          <li>
                            <a
                              href="#configuracoes"
                              onClick={(e) => {
                                e.preventDefault();
                                navigate('/definicoes?aba=empresa');
                              }}
                            >
                              <i className="la la-cog"></i> {t('navigation.settings', 'Dados da Empresa & Configurações')}
                            </a>
                          </li>
                        </>
                      )}
                    </ul>
                    <a
                      href="#logout"
                      className="nav-author__signout"
                      onClick={(e) => {
                        e.preventDefault();
                        handleLogout();
                      }}
                    >
                      <i className="la la-sign-out-alt"></i>{' '}
                      {t('navigation.logout', 'Terminar Sessão')}
                    </a>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
};

export default Header;
