import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SobreNos = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const handleVoltarLogin = () => {
    navigate('/login');
  };

  return (
    <div className="sobre-nos-page" style={{ background: '#f8fafc', minHeight: '100vh', color: '#1e293b' }}>
      {/* Barra de Navegação Superior */}
      <header
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}
      >
        <div className="container py-3 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3" style={{ cursor: 'pointer' }} onClick={handleVoltarLogin}>
            <img
              src="/logo.jpeg"
              alt="SCKJ Logo"
              style={{ height: 42, width: 'auto', borderRadius: 6 }}
            />
            <div>
              <span className="fw-700 text-dark d-block" style={{ fontSize: 16, lineHeight: 1.2 }}>
                SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA
              </span>
              <small className="text-muted fw-500" style={{ fontSize: 12 }}>
                Tecnologia, Contabilidade Digital & Governança Fiscal
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
              style={{ borderRadius: 8, fontSize: 13.5, fontWeight: 600 }}
            >
              <i className="la la-sign-in-alt fs-16"></i>
              Aceder ao Sistema
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
          color: '#ffffff',
          padding: '70px 0 60px',
        }}
      >
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-8 mx-auto text-center">
              <span
                className="badge rounded-pill px-3 py-2 mb-3"
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(8px)',
                  color: '#e0e7ff',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                }}
              >
                🇦🇴 INOVAÇÃO EM GOVERNANÇA TRIBUTÁRIA EM ANGOLA
              </span>
              <h1 className="fw-800 text-white mb-3" style={{ fontSize: '2.5rem', lineHeight: 1.25 }}>
                Sistema de Reconciliação Contabilística e Fiscal
              </h1>
              <p
                className="lead text-light mb-4"
                style={{ fontSize: '1.15rem', color: '#c7d2fe', lineHeight: 1.6, maxWidth: 720, margin: '0 auto' }}
              >
                Concebido e desenvolvido pela <strong>SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA</strong> para garantir a máxima integridade no cruzamento de dados contabilísticos com as declarações fiscais da Administração Geral Tributária (AGT).
              </p>
              <div className="d-flex justify-content-center gap-3 flex-wrap">
                <a
                  href="#sobre-empresa"
                  className="btn btn-light px-4 py-2 fw-600"
                  style={{ borderRadius: 8, color: '#312e81' }}
                >
                  <i className="la la-building mr-1"></i> Sobre a SCKJ
                </a>
                <a
                  href="#o-sistema"
                  className="btn btn-outline-light px-4 py-2 fw-600"
                  style={{ borderRadius: 8 }}
                >
                  <i className="la la-cogs mr-1"></i> A Solução Tecnológica
                </a>
                <a
                  href="#suporte"
                  className="btn btn-warning px-4 py-2 fw-700 text-dark"
                  style={{ borderRadius: 8, background: '#f59e0b', border: 'none' }}
                >
                  <i className="la la-headset mr-1"></i> Suporte Técnico
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Secção: Sobre a Empresa (SCKJ) */}
      <section id="sobre-empresa" className="py-5">
        <div className="container py-3">
          <div className="row align-items-center mb-5">
            <div className="col-lg-6">
              <span className="text-primary fw-700 text-uppercase" style={{ fontSize: 13, letterSpacing: '1px' }}>
                A Empresa Criadora
              </span>
              <h2 className="fw-700 mt-2 mb-3 text-dark" style={{ fontSize: '2rem' }}>
                SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA
              </h2>
              <p className="text-muted" style={{ lineHeight: 1.8, fontSize: 15 }}>
                A <strong>SCKJ</strong> é uma sociedade comercial angolana focada em engenharia de software aplicada à contabilidade avançada, auditoria fiscal preventiva e automação corporativa.
              </p>
              <p className="text-muted" style={{ lineHeight: 1.8, fontSize: 15 }}>
                Combinamos experiência em legislação fiscal angolana com tecnologia de Inteligência Artificial e processamento analítico para resolver o maior desafio das empresas e gabinetes de contabilidade em Angola: a perfeita sintonia entre os lançamentos nas contas do PGC e as liquidações/retenções declaradas nos Modelos Oficiais da AGT.
              </p>

              {/* Ficha Institucional */}
              <div className="card border-0 shadow-sm mt-4" style={{ borderRadius: 12, background: '#ffffff' }}>
                <div className="card-body p-4">
                  <h6 className="fw-700 text-dark mb-3">Dados Cadastrais da Empresa:</h6>
                  <ul className="list-unstyled mb-0 d-flex flex-column gap-2" style={{ fontSize: 14 }}>
                    <li className="d-flex justify-content-between border-bottom pb-2">
                      <span className="text-muted">Denominação Social:</span>
                      <strong className="text-dark">SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA</strong>
                    </li>
                    <li className="d-flex justify-content-between border-bottom pb-2">
                      <span className="text-muted">NIF (Número de Identificação Fiscal):</span>
                      <strong className="text-primary">5002830280</strong>
                    </li>
                    <li className="d-flex justify-content-between border-bottom pb-2">
                      <span className="text-muted">País e Sede:</span>
                      <strong className="text-dark">Luanda, República de Angola</strong>
                    </li>
                    <li className="d-flex justify-content-between">
                      <span className="text-muted">Áreas Principais:</span>
                      <strong className="text-dark">Software Fiscal, Contabilidade & Consultoria</strong>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="col-lg-6 mt-4 mt-lg-0">
              <div className="row g-3">
                <div className="col-sm-6">
                  <div className="card border-0 shadow-sm h-100 p-4" style={{ borderRadius: 12, borderLeft: '4px solid #4f46e5' }}>
                    <div className="text-primary mb-3">
                      <i className="la la-shield-alt" style={{ fontSize: 36 }}></i>
                    </div>
                    <h5 className="fw-700 text-dark">Rigor Normativo</h5>
                    <p className="text-muted mb-0" style={{ fontSize: 14, lineHeight: 1.6 }}>
                      Total conformidade com o Código do IVA (Lei n.º 7/19), retenções na fonte de 6,5% e Plano Geral de Contabilidade (PGC).
                    </p>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="card border-0 shadow-sm h-100 p-4" style={{ borderRadius: 12, borderLeft: '4px solid #059669' }}>
                    <div className="text-success mb-3">
                      <i className="la la-microchip" style={{ fontSize: 36 }}></i>
                    </div>
                    <h5 className="fw-700 text-dark">Inteligência Artificial</h5>
                    <p className="text-muted mb-0" style={{ fontSize: 14, lineHeight: 1.6 }}>
                      Algoritmos determinísticos e modelos neurais para extração de balancetes, faturas e leitura automática de QR Codes AGT.
                    </p>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="card border-0 shadow-sm h-100 p-4" style={{ borderRadius: 12, borderLeft: '4px solid #d97706' }}>
                    <div className="text-warning mb-3">
                      <i className="la la-balance-scale" style={{ fontSize: 36 }}></i>
                    </div>
                    <h5 className="fw-700 text-dark">Auditoria Preventiva</h5>
                    <p className="text-muted mb-0" style={{ fontSize: 14, lineHeight: 1.6 }}>
                      Identificação imediata de divergências antes da submissão dos modelos à AGT, mitigando coimas e fiscalizações.
                    </p>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="card border-0 shadow-sm h-100 p-4" style={{ borderRadius: 12, borderLeft: '4px solid #0284c7' }}>
                    <div className="text-info mb-3">
                      <i className="la la-users-cog" style={{ fontSize: 36 }}></i>
                    </div>
                    <h5 className="fw-700 text-dark">Multi-Empresa</h5>
                    <p className="text-muted mb-0" style={{ fontSize: 14, lineHeight: 1.6 }}>
                      Estrutura concebida para grupos empresariais e gabinetes de contabilidade gerirem múltiplas entidades em ambiente seguro.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Secção: O Sistema */}
      <section id="o-sistema" className="py-5" style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
        <div className="container py-3">
          <div className="text-center max-width-700 mx-auto mb-5">
            <span className="text-primary fw-700 text-uppercase" style={{ fontSize: 13, letterSpacing: '1px' }}>
              Ecossistema Tecnológico
            </span>
            <h2 className="fw-700 mt-2 text-dark" style={{ fontSize: '2rem' }}>
              Como Funciona o Sistema de Reconciliação
            </h2>
            <p className="text-muted" style={{ fontSize: 15 }}>
              Uma plataforma integrada que substitui processos manuais de conferência por uma auditoria digital contínua.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-md-4">
              <div className="p-4 rounded-3 h-100" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span className="badge bg-primary text-white mb-3 px-3 py-2" style={{ fontSize: 12 }}>
                  MÓDULO 01
                </span>
                <h5 className="fw-700 text-dark mb-2">Reconciliação Balancete vs Modelo 7</h5>
                <p className="text-muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
                  Cruzamento das contas 34.5.3 (IVA Liquidado), 34.5.2 (IVA Dedutível) e 34.5.5 (IVA Apurado) contra os campos 1 a 61 da Declaração Modelo 7 da AGT.
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="p-4 rounded-3 h-100" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span className="badge bg-primary text-white mb-3 px-3 py-2" style={{ fontSize: 12 }}>
                  MÓDULO 02
                </span>
                <h5 className="fw-700 text-dark mb-2">Scanner e Leitor Inteligente de Faturas</h5>
                <p className="text-muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
                  Leitura de faturas de fornecedores via OCR/PDF, captura automática de NIF, linhas de itens, taxa de IVA aplicada e validação de certificação de software fiscal.
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="p-4 rounded-3 h-100" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span className="badge bg-primary text-white mb-3 px-3 py-2" style={{ fontSize: 12 }}>
                  MÓDULO 03
                </span>
                <h5 className="fw-700 text-dark mb-2">15 Motores de Análise & Auditoria</h5>
                <p className="text-muted" style={{ fontSize: 14, lineHeight: 1.6 }}>
                  Motores analíticos especializados em estornos, retenções de 6,5%, regime de caixa, cativações, notas de crédito e reconciliação bancária de pagamentos tributários.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Secção de Suporte Técnico & Atendimento */}
      <section id="suporte" className="py-5" style={{ background: '#0f172a', color: '#ffffff' }}>
        <div className="container py-4">
          <div className="row align-items-center mb-5">
            <div className="col-lg-8 mx-auto text-center">
              <span
                className="badge rounded-pill px-3 py-2 mb-3"
                style={{
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#93c5fd',
                  fontSize: 13,
                  fontWeight: 600,
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                }}
              >
                CANAIS OFICIAIS DE ATENDIMENTO
              </span>
              <h2 className="fw-800 text-white mb-3" style={{ fontSize: '2.2rem' }}>
                Suporte Técnico e Assistência Especializada
              </h2>
              <p className="text-light" style={{ fontSize: 16, color: '#94a3b8', lineHeight: 1.7 }}>
                A equipa da <strong>SCKJ</strong> está disponível para prestar todo o suporte necessário aos utilizadores, operadores de faturação, contabilistas e administradores do sistema.
              </p>
            </div>
          </div>

          <div className="row g-4 justify-content-center">
            {/* Card 1: Suporte Técnico */}
            <div className="col-lg-4 col-md-6">
              <div
                className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between"
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div>
                  <div
                    className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                    style={{ width: 50, height: 50, background: '#3b82f6', color: '#ffffff', fontSize: 24 }}
                  >
                    <i className="la la-headset"></i>
                  </div>
                  <h5 className="fw-700 text-white mb-2">Suporte Técnico da Plataforma</h5>
                  <p className="text-muted mb-3" style={{ fontSize: 14, color: '#94a3b8' }}>
                    Dúvidas técnicas sobre o funcionamento do sistema, redefinição de acessos, erros de carregamento e importação de ficheiros.
                  </p>
                </div>
                <div>
                  <a
                    href="mailto:suporte@sckj.co.ao?subject=Pedido%20de%20Suporte%20Tecnico%20-%20Sistema%20IVA"
                    className="btn btn-outline-primary w-100 fw-600 text-white py-2"
                    style={{ borderColor: '#3b82f6', borderRadius: 8 }}
                  >
                    <i className="la la-envelope mr-1"></i> suporte@sckj.co.ao
                  </a>
                </div>
              </div>
            </div>

            {/* Card 2: Consultoria Fiscal & Auditoria */}
            <div className="col-lg-4 col-md-6">
              <div
                className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between"
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div>
                  <div
                    className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                    style={{ width: 50, height: 50, background: '#10b981', color: '#ffffff', fontSize: 24 }}
                  >
                    <i className="la la-file-invoice-dollar"></i>
                  </div>
                  <h5 className="fw-700 text-white mb-2">Gabinete de Auditoria Fiscal</h5>
                  <p className="text-muted mb-3" style={{ fontSize: 14, color: '#94a3b8' }}>
                    Esclarecimento de divergências no Modelo 7, regras do CIVA (Lei n.º 7/19), dedutibilidade de faturas e cruzamento de balancetes.
                  </p>
                </div>
                <div>
                  <a
                    href="mailto:auditoria@sckj.co.ao?subject=Consulta%20Fiscal%20e%20Auditoria%20-%20Sistema%20IVA"
                    className="btn btn-outline-success w-100 fw-600 text-white py-2"
                    style={{ borderColor: '#10b981', borderRadius: 8 }}
                  >
                    <i className="la la-envelope mr-1"></i> auditoria@sckj.co.ao
                  </a>
                </div>
              </div>
            </div>

            {/* Card 3: Direção & Atendimento Geral */}
            <div className="col-lg-4 col-md-6">
              <div
                className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between"
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div>
                  <div
                    className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                    style={{ width: 50, height: 50, background: '#f59e0b', color: '#ffffff', fontSize: 24 }}
                  >
                    <i className="la la-phone-volume"></i>
                  </div>
                  <h5 className="fw-700 text-white mb-2">Atendimento Administrativo</h5>
                  <p className="text-muted mb-3" style={{ fontSize: 14, color: '#94a3b8' }}>
                    Contratos, subscrições de empresas, parcerias institucionais e contacto direto com a administração da SCKJ.
                  </p>
                </div>
                <div>
                  <a
                    href="mailto:muquissicarlos@gmail.com?subject=Contacto%20Institucional%20-%20SCKJ"
                    className="btn btn-outline-warning w-100 fw-600 text-white py-2"
                    style={{ borderColor: '#f59e0b', borderRadius: 8 }}
                  >
                    <i className="la la-envelope mr-1"></i> Contactar Administração
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Horário & Localização */}
          <div
            className="mt-5 p-4 rounded-4"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="row text-center text-md-start align-items-center">
              <div className="col-md-4 mb-3 mb-md-0 d-flex align-items-center justify-content-center justify-content-md-start gap-3">
                <i className="la la-clock text-primary fs-28"></i>
                <div>
                  <strong className="d-block text-white">Horário de Funcionamento</strong>
                  <span className="text-muted" style={{ fontSize: 13, color: '#94a3b8' }}>
                    Segunda a Sexta: 08:00 – 17:30 (GMT+1)
                  </span>
                </div>
              </div>

              <div className="col-md-4 mb-3 mb-md-0 d-flex align-items-center justify-content-center justify-content-md-start gap-3">
                <i className="la la-map-marker-alt text-danger fs-28"></i>
                <div>
                  <strong className="d-block text-white">Localização</strong>
                  <span className="text-muted" style={{ fontSize: 13, color: '#94a3b8' }}>
                    Luanda, República de Angola
                  </span>
                </div>
              </div>

              <div className="col-md-4 text-center text-md-end">
                <button
                  onClick={handleVoltarLogin}
                  className="btn btn-primary px-4 py-2 fw-700"
                  style={{ borderRadius: 8 }}
                >
                  <i className="la la-arrow-left mr-1"></i> Voltar ao Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rodapé Final */}
      <footer style={{ background: '#090d16', color: '#64748b', padding: '25px 0', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div className="container text-center">
          <p className="mb-1" style={{ fontSize: 13 }}>
            © 2026 <strong>SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA</strong> • NIF: 5002830280 • Todos os direitos reservados.
          </p>
          <small style={{ fontSize: 12 }}>
            Sistema de Reconciliação Contabilística e Fiscal • Luanda, Angola
          </small>
        </div>
      </footer>
    </div>
  );
};

export default SobreNos;
