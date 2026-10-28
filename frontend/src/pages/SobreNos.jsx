import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SobreNos = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const handleVoltarLogin = () => {
    navigate('/login');
  };

  return (
    <div className="sobre-nos-page" style={{ background: '#ffffff', minHeight: '100vh', color: '#1e293b' }}>
      {/* Barra de Navegação Superior */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div className="container py-3 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3" style={{ cursor: 'pointer' }} onClick={handleVoltarLogin}>
            <img
              src="/logo.jpeg"
              alt="SCKJ"
              style={{ height: 40, width: 'auto', borderRadius: 4 }}
            />
            <div>
              <span className="fw-700 text-dark d-block" style={{ fontSize: 15, lineHeight: 1.2 }}>
                {t('about.companyName', 'SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA')}
              </span>
              <small className="text-muted" style={{ fontSize: 12 }}>
                {t('about.companySubtitle', 'Tecnologia & Governança Contabilística e Fiscal')}
              </small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Seletor de Idioma */}
            <div className="btn-group me-2" role="group">
              {[
                { code: 'pt', label: 'PT', flag: '🇦🇴' },
                { code: 'en', label: 'EN', flag: '🇬🇧' },
                { code: 'zh', label: 'ZH', flag: '🇨🇳' },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={`btn btn-sm ${i18n.language?.substring(0, 2) === lang.code ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  onClick={() => i18n.changeLanguage(lang.code)}
                >
                  <span style={{ marginRight: 3 }}>{lang.flag}</span>
                  {lang.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleVoltarLogin}
              className="btn btn-primary d-inline-flex align-items-center gap-2 px-3 py-2"
              style={{ borderRadius: 6, fontSize: 13.5, fontWeight: 600 }}
            >
              <i className="la la-sign-in-alt fs-16"></i>
              {t('about.accessSystem', 'Aceder ao Sistema')}
            </button>
          </div>
        </div>
      </header>

      {/* Hero / Apresentação Inicial com Fundo Branco */}
      <section className="py-5" style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9' }}>
        <div className="container py-4 text-center">
          <div className="row justify-content-center">
            <div className="col-lg-9">
              <span
                className="badge px-3 py-2 mb-3"
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 20,
                  border: '1px solid #e2e8f0',
                }}
              >
                {t('about.heroBadge', 'SCKJ • LUANDA, ANGOLA')}
              </span>
              <h1 className="fw-700 text-dark mb-3" style={{ fontSize: '2.4rem', lineHeight: 1.25 }}>
                {t('about.title', 'Sistema de Reconciliação Contabilística e Fiscal')}
              </h1>
              <p
                className="text-muted mx-auto mb-4"
                style={{ fontSize: '1.1rem', lineHeight: 1.7, maxWidth: 740 }}
              >
                {t('about.heroDescription', 'Desenvolvido pela SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA para garantir rigor na conciliação entre o Plano Geral de Contabilidade (PGC), o Código do IVA (CIVA - Lei n.º 7/19) e as declarações Modelo 7 submetidas à Administração Geral Tributária (AGT).')}
              </p>

              <div className="d-flex justify-content-center gap-2 flex-wrap">
                <a
                  href="#sobre-empresa"
                  className="btn btn-outline-secondary px-3 py-2"
                  style={{ borderRadius: 6, fontSize: 13.5, fontWeight: 500 }}
                >
                  <i className="la la-building mr-1"></i> {t('about.aboutCompany', 'Sobre a Empresa')}
                </a>
                <a
                  href="#o-sistema"
                  className="btn btn-outline-secondary px-3 py-2"
                  style={{ borderRadius: 6, fontSize: 13.5, fontWeight: 500 }}
                >
                  <i className="la la-cogs mr-1"></i> {t('about.systemModules', 'Módulos do Sistema')}
                </a>
                <a
                  href="#suporte"
                  className="btn btn-primary px-3 py-2"
                  style={{ borderRadius: 6, fontSize: 13.5, fontWeight: 600 }}
                >
                  <i className="la la-headset mr-1"></i> {t('about.supportAndContacts', 'Suporte & Contactos')}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Secção: Sobre a Empresa (SCKJ) - Fundo Branco */}
      <section id="sobre-empresa" className="py-5" style={{ background: '#ffffff' }}>
        <div className="container py-3">
          <div className="row align-items-center">
            <div className="col-lg-6 mb-4 mb-lg-0">
              <span className="text-muted fw-600 text-uppercase" style={{ fontSize: 12, letterSpacing: '0.5px' }}>
                {t('about.theCreatorCompany', 'A Empresa Criadora')}
              </span>
              <h2 className="fw-700 mt-1 mb-3 text-dark" style={{ fontSize: '1.85rem' }}>
                {t('about.companyName', 'SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA')}
              </h2>
              <p className="text-muted" style={{ lineHeight: 1.8, fontSize: 14.5 }}>
                {t('about.companyBio1', 'A SCKJ é uma sociedade empresarial angolana vocacionada para a consultoria contábil, auditoria fiscal digital e engenharia de software aplicada à gestão corporativa.')}
              </p>
              <p className="text-muted" style={{ lineHeight: 1.8, fontSize: 14.5 }}>
                {t('about.companyBio2', 'O nosso propósito é dotar contabilistas, peritos fiscais e equipas de auditoria de soluções modernas que eliminem divergências entre as contas da classe 34 (Estado e Outros Entes Públicos) e as obrigações declarativas oficiais da AGT em Angola.')}
              </p>

              {/* Ficha Cadastral Limpa */}
              <div className="card border p-3 mt-4" style={{ borderRadius: 8, borderColor: '#e2e8f0', background: '#ffffff' }}>
                <h6 className="fw-700 text-dark mb-3" style={{ fontSize: 14 }}>{t('about.institutionalData', 'Dados Institucionais:')}</h6>
                <ul className="list-unstyled mb-0 d-flex flex-column gap-2" style={{ fontSize: 13.5 }}>
                  <li className="d-flex justify-content-between border-bottom pb-2">
                    <span className="text-muted">{t('about.corporateName', 'Razão Social:')}</span>
                    <strong className="text-dark">SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA</strong>
                  </li>
                  <li className="d-flex justify-content-between border-bottom pb-2">
                    <span className="text-muted">{t('about.taxId', 'NIF:')}</span>
                    <strong className="text-dark">5002830280</strong>
                  </li>
                  <li className="d-flex justify-content-between border-bottom pb-2">
                    <span className="text-muted">{t('about.location', 'País / Cidade:')}</span>
                    <strong className="text-dark">{t('about.locationVal', 'Luanda, República de Angola')}</strong>
                  </li>
                  <li className="d-flex justify-content-between">
                    <span className="text-muted">{t('about.specialty', 'Especialidade:')}</span>
                    <strong className="text-dark">{t('about.specialtyVal', 'Sistemas Contabilísticos, Auditoria Fiscal & IA')}</strong>
                  </li>
                </ul>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="row g-3">
                <div className="col-sm-6">
                  <div className="card border p-3 h-100" style={{ borderRadius: 8, borderColor: '#e2e8f0', background: '#ffffff' }}>
                    <h6 className="fw-700 text-dark mb-2">{t('about.legalCompliance', 'Conformidade Legal')}</h6>
                    <p className="text-muted mb-0" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                      {t('about.legalComplianceDesc', 'Alinhamento integral com a Lei n.º 7/19 (CIVA), retenções na fonte de 6,5% e Plano Geral de Contabilidade (PGC).')}
                    </p>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="card border p-3 h-100" style={{ borderRadius: 8, borderColor: '#e2e8f0', background: '#ffffff' }}>
                    <h6 className="fw-700 text-dark mb-2">{t('about.exactReconciliation', 'Reconciliação Exata')}</h6>
                    <p className="text-muted mb-0" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                      {t('about.exactReconciliationDesc', 'Cruzamento automatizado entre Balancetes de Verificação e os campos 1 a 61 do Modelo 7 da AGT.')}
                    </p>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="card border p-3 h-100" style={{ borderRadius: 8, borderColor: '#e2e8f0', background: '#ffffff' }}>
                    <h6 className="fw-700 text-dark mb-2">{t('about.scannerOcr', 'Scanner & OCR')}</h6>
                    <p className="text-muted mb-0" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                      {t('about.scannerOcrDesc', 'Leitura óptica de facturas de fornecedores em PDF/imagem com validação de QR Code fiscal e certificação AGT.')}
                    </p>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="card border p-3 h-100" style={{ borderRadius: 8, borderColor: '#e2e8f0', background: '#ffffff' }}>
                    <h6 className="fw-700 text-dark mb-2">{t('about.multiCompany', 'Multi-Empresa')}</h6>
                    <p className="text-muted mb-0" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                      {t('about.multiCompanyDesc', 'Ambiente seguro para gabinetes de contabilidade e grupos empresariais gerirem várias empresas de forma independente.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Secção: O Sistema - Fundo Branco */}
      <section id="o-sistema" className="py-5" style={{ background: '#ffffff', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
        <div className="container py-3">
          <div className="text-center mb-4">
            <span className="text-muted fw-600 text-uppercase" style={{ fontSize: 12, letterSpacing: '0.5px' }}>
              {t('about.archTitle', 'Arquitectura do Sistema')}
            </span>
            <h2 className="fw-700 mt-1 text-dark" style={{ fontSize: '1.85rem' }}>
              {t('about.mainModules', 'Módulos Principais')}
            </h2>
            <p className="text-muted" style={{ fontSize: 14 }}>
              {t('about.archDesc', 'Processamento seguro e estruturado para auditoria fiscal contínua.')}
            </p>
          </div>

          <div className="row g-3">
            <div className="col-md-4">
              <div className="card border p-4 h-100" style={{ borderRadius: 8, borderColor: '#e2e8f0', background: '#ffffff' }}>
                <span className="text-muted fw-600 d-block mb-1" style={{ fontSize: 12 }}>
                  {t('about.mod1', 'MÓDULO 01')}
                </span>
                <h5 className="fw-700 text-dark mb-2" style={{ fontSize: 16 }}>{t('about.mod1Title', 'Reconciliação Balancete vs Modelo 7')}</h5>
                <p className="text-muted mb-0" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                  {t('about.mod1Desc', 'Comparação sistemática das contas 34.5.3 (IVA Liquidado), 34.5.2 (IVA Dedutível) e 34.5.5 (IVA Apurado) contra as declarações Modelo 7 submetidas à AGT.')}
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card border p-4 h-100" style={{ borderRadius: 8, borderColor: '#e2e8f0', background: '#ffffff' }}>
                <span className="text-muted fw-600 d-block mb-1" style={{ fontSize: 12 }}>
                  {t('about.mod2', 'MÓDULO 02')}
                </span>
                <h5 className="fw-700 text-dark mb-2" style={{ fontSize: 16 }}>{t('about.mod2Title', 'Scanner e OCR de Facturas')}</h5>
                <p className="text-muted mb-0" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                  {t('about.mod2Desc', 'Digitalização inteligente de facturas, extracção de dados fiscais (NIF, linhas, taxas, IVA dedutível/não dedutível) e arquivo digital auditável.')}
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card border p-4 h-100" style={{ borderRadius: 8, borderColor: '#e2e8f0', background: '#ffffff' }}>
                <span className="text-muted fw-600 d-block mb-1" style={{ fontSize: 12 }}>
                  {t('about.mod3', 'MÓDULO 03')}
                </span>
                <h5 className="fw-700 text-dark mb-2" style={{ fontSize: 16 }}>{t('about.mod3Title', '15 Motores de Auditoria Fiscal')}</h5>
                <p className="text-muted mb-0" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                  {t('about.mod3Desc', 'Análise de retenções na fonte de 6,5%, estornos, cativações, notas de crédito e relatórios executivos prontos para impressão ou exportação.')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Secção: Suporte Técnico & Contactos - Fundo Branco */}
      <section id="suporte" className="py-5" style={{ background: '#ffffff' }}>
        <div className="container py-3">
          <div className="text-center mb-4">
            <span className="text-muted fw-600 text-uppercase" style={{ fontSize: 12, letterSpacing: '0.5px' }}>
              {t('about.supportSection', 'Atendimento e Assistência')}
            </span>
            <h2 className="fw-700 mt-1 text-dark" style={{ fontSize: '1.85rem' }}>
              {t('about.supportTitle', 'Suporte Técnico & Contactos Oficiais')}
            </h2>
            <p className="text-muted" style={{ fontSize: 14 }}>
              {t('about.supportDesc', 'Canais diretos para operadores de facturação, contabilistas e administradores do sistema.')}
            </p>
          </div>

          <div className="row g-3 justify-content-center">
            {/* Suporte Técnico */}
            <div className="col-lg-4 col-md-6">
              <div className="card border p-4 h-100 d-flex flex-column justify-content-between" style={{ borderRadius: 8, borderColor: '#e2e8f0', background: '#ffffff' }}>
                <div>
                  <h6 className="fw-700 text-dark mb-2" style={{ fontSize: 15 }}>{t('about.techSupportTitle', 'Suporte Técnico da Plataforma')}</h6>
                  <p className="text-muted mb-3" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                    {t('about.techSupportDesc', 'Dúvidas sobre o funcionamento do software, criação de utilizadores, importação de documentos e redefinição de acessos.')}
                  </p>
                </div>
                <div>
                  <a
                    href="mailto:suporte@sckj.co.ao?subject=Suporte%20Tecnico%20-%20Sistema%20IVA"
                    className="btn btn-outline-secondary w-100 text-dark fw-500 py-2"
                    style={{ borderRadius: 6, fontSize: 13.5 }}
                  >
                    <i className="la la-envelope mr-1"></i> suporte@sckj.co.ao
                  </a>
                </div>
              </div>
            </div>

            {/* Gabinete Fiscal */}
            <div className="col-lg-4 col-md-6">
              <div className="card border p-4 h-100 d-flex flex-column justify-content-between" style={{ borderRadius: 8, borderColor: '#e2e8f0', background: '#ffffff' }}>
                <div>
                  <h6 className="fw-700 text-dark mb-2" style={{ fontSize: 15 }}>{t('about.fiscalOfficeTitle', 'Gabinete de Auditoria Fiscal')}</h6>
                  <p className="text-muted mb-3" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                    {t('about.fiscalOfficeDesc', 'Esclarecimento de divergências contabilísticas, normas do CIVA (Lei n.º 7/19) e validação de relatórios para a AGT.')}
                  </p>
                </div>
                <div>
                  <a
                    href="mailto:auditoria@sckj.co.ao?subject=Auditoria%20Fiscal%20-%20Sistema%20IVA"
                    className="btn btn-outline-secondary w-100 text-dark fw-500 py-2"
                    style={{ borderRadius: 6, fontSize: 13.5 }}
                  >
                    <i className="la la-envelope mr-1"></i> auditoria@sckj.co.ao
                  </a>
                </div>
              </div>
            </div>

            {/* Atendimento Geral */}
            <div className="col-lg-4 col-md-6">
              <div className="card border p-4 h-100 d-flex flex-column justify-content-between" style={{ borderRadius: 8, borderColor: '#e2e8f0', background: '#ffffff' }}>
                <div>
                  <h6 className="fw-700 text-dark mb-2" style={{ fontSize: 15 }}>{t('about.adminOfficeTitle', 'Administração & Atendimento Geral')}</h6>
                  <p className="text-muted mb-3" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                    {t('about.adminOfficeDesc', 'Contacto institucional com a direção da SCKJ, contratos corporativos, licenciamento e novas empresas.')}
                  </p>
                </div>
                <div>
                  <a
                    href="mailto:muquissicarlos@gmail.com?subject=Contacto%20Institucional%20-%20SCKJ"
                    className="btn btn-outline-secondary w-100 text-dark fw-500 py-2"
                    style={{ borderRadius: 6, fontSize: 13.5 }}
                  >
                    <i className="la la-envelope mr-1"></i> {t('about.contactAdminBtn', 'Contactar Direção')}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Horário e Localização em Caixa Branca com Borda Fina */}
          <div className="card border p-4 mt-4" style={{ borderRadius: 8, borderColor: '#e2e8f0', background: '#ffffff' }}>
            <div className="row text-center text-md-start align-items-center">
              <div className="col-md-4 mb-3 mb-md-0">
                <span className="text-muted d-block" style={{ fontSize: 12 }}>{t('about.hoursTitle', 'HORÁRIO DE FUNCIONAMENTO')}</span>
                <strong className="text-dark" style={{ fontSize: 14 }}>{t('about.hoursVal', 'Segunda a Sexta: 08:00 – 17:30 (GMT+1)')}</strong>
              </div>

              <div className="col-md-4 mb-3 mb-md-0">
                <span className="text-muted d-block" style={{ fontSize: 12 }}>{t('about.locationTitle', 'LOCALIZAÇÃO')}</span>
                <strong className="text-dark" style={{ fontSize: 14 }}>{t('about.locationVal', 'Luanda, República de Angola')}</strong>
              </div>

              <div className="col-md-4 text-center text-md-end">
                <button
                  onClick={handleVoltarLogin}
                  className="btn btn-primary px-4 py-2 fw-600"
                  style={{ borderRadius: 6, fontSize: 13.5 }}
                >
                  <i className="la la-arrow-left mr-1"></i> {t('about.backToLogin', 'Voltar ao Login')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rodapé Final Limpo em Fundo Branco */}
      <footer style={{ background: '#ffffff', color: '#64748b', padding: '25px 0', borderTop: '1px solid #e2e8f0' }}>
        <div className="container text-center">
          <p className="mb-1 text-muted" style={{ fontSize: 13 }}>
            {t('about.copyright', '© 2026 SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA • NIF: 5002830280 • Todos os direitos reservados.')}
          </p>
          <small className="text-muted" style={{ fontSize: 12 }}>
            {t('about.title', 'Sistema de Reconciliação Contabilística e Fiscal')} • {t('about.locationVal', 'Luanda, República de Angola')}
          </small>
        </div>
      </footer>
    </div>
  );
};

export default SobreNos;
