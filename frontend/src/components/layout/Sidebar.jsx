import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mainMenuItems } from './menuConfig';
import ConfirmModal from '../common/ConfirmModal';

const Sidebar = ({ collapsed, onNavigate }) => {
  const { t } = useTranslation();
  const [confirmarLogout, setConfirmarLogout] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('periodoAuditoria');
    window.dispatchEvent(new Event('auth-changed'));
    setConfirmarLogout(false);
    navigate('/login');
  };

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : {};
  const isAdmin = Boolean(user.is_admin || user.is_superuser || user.is_staff);
  const isOperador = Boolean(user.is_operador_facturas || user.papel === 'Operador de Facturação');

  const itensMenu = isOperador
    ? [
        {
          path: '/facturas',
          icon: 'la la-file-invoice-dollar',
          textKey: 'headerUi.scannerPortal',
          fallbackText: 'Portal do Scanner (Facturas)',
          text: 'Portal do Scanner (Facturas)',
        },
      ]
    : mainMenuItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      <aside className="sidebar-wrapper">
        <div id="sidebar" className={`sidebar ${collapsed ? 'collapsed' : 'sidebar-collapse'}`}>
          <div className="sidebar__menu-group" style={{ padding: '16px 12px' }}>
            <ul className="sidebar_nav">
              <li className="menu-title" style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#8c98a4' }}>
                <span>{isOperador ? t('headerUi.invoiceEntry', 'Entrada de Facturas') : t('sidebar.mainSection', 'Menu Principal')}</span>
              </li>
              {itensMenu.map((item) => (
                <li key={item.path} style={{ marginBottom: 4 }}>
                  <NavLink
                    to={item.path}
                    onClick={onNavigate}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                  >
                    <span className="nav-icon">
                      <i className={item.icon}></i>
                    </span>
                    <span className="menu-text">
                      {t(item.textKey, item.fallbackText || item.text)}
                    </span>
                  </NavLink>
                </li>
              ))}

              <li className="menu-title mt-20 pt-10" style={{ borderTop: '1px solid #edf0f5', padding: '8px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#8c98a4' }}>
                <span>{t('sidebar.systemSection', 'Sessão')}</span>
              </li>
              <li>
                <a
                  href="#logout"
                  onClick={(e) => {
                    e.preventDefault();
                    setConfirmarLogout(true);
                  }}
                  className="sidebar-logout-link"
                  style={{ cursor: 'pointer' }}
                >
                  <span className="nav-icon" style={{ backgroundColor: '#ffffff', border: '1px solid #fecaca' }}>
                    <i className="la la-sign-out-alt text-danger"></i>
                  </span>
                  <span className="menu-text text-danger fw-600">
                    {t('navigation.logout', 'Terminar Sessão')}
                  </span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </aside>

      <ConfirmModal
        show={confirmarLogout}
        onClose={() => setConfirmarLogout(false)}
        onConfirm={handleLogout}
        title={t('logoutModal.title', 'Terminar Sessão')}
        subtitle={t('logoutModal.subtitle', 'Confirmação de encerramento de acesso')}
        confirmLabel={t('logoutModal.confirm', 'Sim, Terminar Sessão')}
        confirmClass="btn-danger"
      >
        <p className="mb-0 text-muted" style={{ fontSize: 13.5 }}>
          {t(
            'logoutModal.message',
            'Deseja realmente sair da sua conta? Terá de introduzir o seu utilizador e palavra-passe para voltar a aceder ao sistema.'
          )}
        </p>
      </ConfirmModal>
    </>
  );
};

export default Sidebar;

