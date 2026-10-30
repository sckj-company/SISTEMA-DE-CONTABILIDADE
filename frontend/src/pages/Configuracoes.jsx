import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import api, { authService, empresaService } from '../services/api';
import { usePeriodo } from '../context/PeriodoContext';
import Taxas from '../components/definicoes/Taxas';

const BADGE_REGIME = {
  GERAL: 'badge-primary',
  SIMPLIFICADO: 'badge-info',
  EXCLUSAO: 'badge-secondary',
};

const TIPOS_ENTIDADE = [
  { value: 'SQ', label: 'Sociedade por Quotas (Lda / SU)' },
  { value: 'SA', label: 'Sociedade Anónima (S.A.)' },
  { value: 'ENI', label: 'Empresário em Nome Individual (ENI)' },
  { value: 'PS', label: 'Pessoa Singular' },
  { value: 'COOP', label: 'Cooperativa' },
  { value: 'ASS', label: 'Associação' },
  { value: 'FUND', label: 'Fundação' },
  { value: 'OUTRO', label: 'Outro' },
];

const PROVINCIAS_ANGOLA = [
  'Luanda',
  'Bengo',
  'Benguela',
  'Bié',
  'Cabinda',
  'Cuando',
  'Cubango',
  'Cuanza Norte',
  'Cuanza Sul',
  'Cunene',
  'Huambo',
  'Huíla',
  'Icolo e Bengo',
  'Lunda Norte',
  'Lunda Sul',
  'Malanje',
  'Moxico',
  'Moxico Leste',
  'Namibe',
  'Uíge',
  'Zaire',
];

const criarFormEmpresa = (emp) => ({
  nome: emp?.nome || '',
  nome_comercial: emp?.nome_comercial || '',
  nif: emp?.nif || '',
  tipo_entidade: emp?.tipo_entidade || 'SQ',
  atividade_principal: emp?.atividade_principal || '',
  cae_principal: emp?.cae_principal || '',
  regime_iva: emp?.regime_iva || 'GERAL',
  reparticao_fiscal: emp?.reparticao_fiscal || '',
  provincia: emp?.provincia || 'Luanda',
  municipio: emp?.municipio || '',
  endereco: emp?.endereco || '',
  telefone: emp?.telefone || '',
  email: emp?.email || '',
  website: emp?.website || '',
  contabilista_nome: emp?.contabilista_nome || '',
  contabilista_contacto: emp?.contabilista_contacto || '',
});

const Configuracoes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const periodoCtx = usePeriodo() || {};
  const { empresaId, atualizar, carregarEmpresas } = periodoCtx;

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = Boolean(currentUser.is_admin || currentUser.is_superuser || currentUser.is_staff);
  const isOperadorFacturas = Boolean(
    !isAdmin && (currentUser.is_operador_facturas || currentUser.papel === 'Operador de Facturação')
  );
  const isSomenteConsulta = Boolean(!isAdmin && currentUser.papel === 'Consulta');

  const abaInicial = () => {
    if (isOperadorFacturas) return 'perfil';
    const abaUrl = searchParams.get('aba');
    if (abaUrl && ['empresa', 'perfil', 'parametros'].includes(abaUrl)) return abaUrl;
    if (location.pathname === '/perfil') return 'perfil';
    return 'empresa';
  };

  const [abaAtiva, setAbaAtiva] = useState(abaInicial);
  const [empresas, setEmpresas] = useState([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState(null);
  const [empresaForm, setEmpresaForm] = useState(() => criarFormEmpresa(null));
  const [carregandoEmpresa, setCarregandoEmpresa] = useState(false);
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);

  // Perfil do Utilizador
  const [user, setUser] = useState(currentUser);
  const [perfilForm, setPerfilForm] = useState({
    first_name: currentUser.first_name || '',
    last_name: currentUser.last_name || '',
    username: currentUser.username || '',
    email: currentUser.email || '',
    currentPassword: '',
    password: '',
    confirmPassword: '',
  });
  const [mostrarSenhas, setMostrarSenhas] = useState(false);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  // Sincronizar aba quando a URL muda (ex.: clicar em "O Meu Perfil" no cabeçalho)
  useEffect(() => {
    if (isOperadorFacturas) {
      setAbaAtiva('perfil');
      return;
    }
    const abaUrl = searchParams.get('aba');
    if (abaUrl && ['empresa', 'perfil', 'parametros'].includes(abaUrl)) {
      setAbaAtiva(abaUrl);
    } else if (location.pathname === '/perfil') {
      setAbaAtiva('perfil');
    }
  }, [location.pathname, searchParams, isOperadorFacturas]);

  const mudarAba = (novaAba) => {
    setAbaAtiva(novaAba);
    if (location.pathname === '/definicoes') {
      setSearchParams({ aba: novaAba }, { replace: true });
    }
  };

  // Carregar lista de empresas
  const carregarListaEmpresas = useCallback(() => {
    if (isOperadorFacturas) return;
    api
      .get('/empresas/')
      .then((res) => {
        const lista = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setEmpresas(lista);
        if (lista.length > 0 && !empresaId && atualizar) {
          const sckj = lista.find((e) => e.nif === '5002830280');
          const idInicial = String(sckj ? sckj.id : lista[0].id);
          atualizar({ empresaId: idInicial });
        }
      })
      .catch((err) => console.error('Erro ao carregar empresas:', err));
  }, [empresaId, atualizar, isOperadorFacturas]);

  useEffect(() => {
    carregarListaEmpresas();
  }, [carregarListaEmpresas]);

  // Carregar dados da empresa ativa
  useEffect(() => {
    if (!empresaId || isOperadorFacturas) return;
    setCarregandoEmpresa(true);
    api
      .get(`/empresas/${empresaId}/`)
      .then((res) => {
        setEmpresaSelecionada(res.data);
        setEmpresaForm(criarFormEmpresa(res.data));
      })
      .catch((err) => {
        console.error('Erro ao buscar detalhe da empresa:', err);
      })
      .finally(() => setCarregandoEmpresa(false));
  }, [empresaId, isOperadorFacturas]);

  // Carregar perfil atualizado do utilizador a partir do backend (com fallback ao localStorage)
  useEffect(() => {
    const stored = localStorage.getItem('user');
    let tokenAtual = '';
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        tokenAtual = parsed.token || '';
        setUser(parsed);
        setPerfilForm((prev) => ({
          ...prev,
          first_name: parsed.first_name || '',
          last_name: parsed.last_name || '',
          username: parsed.username || '',
          email: parsed.email || '',
        }));
      } catch (e) {
        console.error('Erro ao ler utilizador:', e);
      }
    }

    if (tokenAtual && authService && typeof authService.getPerfil === 'function') {
      const req = authService.getPerfil();
      if (req && typeof req.then === 'function') {
        req
          .then((res) => {
            const u = res?.data?.user;
            if (u) {
              const merged = { ...JSON.parse(localStorage.getItem('user') || '{}'), ...u };
              localStorage.setItem('user', JSON.stringify(merged));
              setUser(merged);
              setPerfilForm((prev) => ({
                ...prev,
                first_name: merged.first_name || '',
                last_name: merged.last_name || '',
                username: merged.username || '',
                email: merged.email || '',
              }));
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  const handleSalvarEmpresa = async (e) => {
    e.preventDefault();
    if (!empresaSelecionada?.id) return;
    if (!empresaForm.nome.trim() || !empresaForm.nif.trim()) {
      toast.warning(t('configuracoes.companyRequired', 'A Razão Social e o NIF da empresa são obrigatórios.'));
      return;
    }

    setSalvandoEmpresa(true);
    try {
      const payload = {
        ...empresaForm,
        nome: empresaForm.nome.trim(),
        nome_comercial: empresaForm.nome_comercial.trim(),
        nif: empresaForm.nif.trim(),
        atividade_principal: empresaForm.atividade_principal.trim(),
        cae_principal: empresaForm.cae_principal.trim(),
        reparticao_fiscal: empresaForm.reparticao_fiscal.trim(),
        provincia: empresaForm.provincia,
        municipio: empresaForm.municipio.trim(),
        endereco: empresaForm.endereco.trim() || null,
        telefone: empresaForm.telefone.trim() || null,
        email: empresaForm.email.trim() || null,
        website: empresaForm.website.trim() || null,
        contabilista_nome: empresaForm.contabilista_nome.trim(),
        contabilista_contacto: empresaForm.contabilista_contacto.trim(),
      };

      const res = empresaService?.patch
        ? await empresaService.patch(empresaSelecionada.id, payload)
        : await api.patch(`/empresas/${empresaSelecionada.id}/`, payload);

      const atualizada = res.data;
      setEmpresaSelecionada(atualizada);
      setEmpresaForm(criarFormEmpresa(atualizada));
      setEmpresas((prev) => prev.map((item) => (item.id === atualizada.id ? atualizada : item)));
      if (typeof carregarEmpresas === 'function') {
        carregarEmpresas();
      }
      toast.success(t('configuracoes.companySaved', 'Dados da empresa guardados com sucesso!'));
    } catch (err) {
      const dataErr = err.response?.data;
      let msg = t('configuracoes.companySaveError', 'Não foi possível guardar os dados da empresa.');
      if (typeof dataErr?.error === 'string') {
        msg = dataErr.error;
      } else if (typeof dataErr?.detail === 'string') {
        msg = dataErr.detail;
      } else if (dataErr && typeof dataErr === 'object') {
        const primeiraChave = Object.keys(dataErr)[0];
        if (primeiraChave) {
          const val = Array.isArray(dataErr[primeiraChave]) ? dataErr[primeiraChave][0] : dataErr[primeiraChave];
          msg = `${primeiraChave}: ${val}`;
        }
      }
      toast.error(msg);
    } finally {
      setSalvandoEmpresa(false);
    }
  };

  const handleSalvarPerfil = async (e) => {
    e.preventDefault();
    if (!perfilForm.username.trim()) {
      toast.warning(t('configuracoes.usernameRequired', 'O nome de utilizador não pode ficar vazio.'));
      return;
    }

    if (perfilForm.password || perfilForm.confirmPassword) {
      if (!perfilForm.currentPassword) {
        toast.warning(
          t('configuracoes.currentPassRequired', 'Informe a sua palavra-passe atual para definir uma nova palavra-passe.')
        );
        return;
      }
      if (perfilForm.password !== perfilForm.confirmPassword) {
        toast.error(t('configuracoes.toastPassMismatch', 'A nova palavra-passe e a confirmação não coincidem.'));
        return;
      }
      if (perfilForm.password.length < 6) {
        toast.error(t('configuracoes.toastPassMin', 'A nova palavra-passe deve ter pelo menos 6 caracteres.'));
        return;
      }
    }

    setSalvandoPerfil(true);
    try {
      const payload = {
        username: perfilForm.username.trim(),
        first_name: perfilForm.first_name.trim(),
        last_name: perfilForm.last_name.trim(),
        email: perfilForm.email.trim(),
      };

      if (perfilForm.password) {
        payload.current_password = perfilForm.currentPassword;
        payload.new_password = perfilForm.password;
      }

      const res = authService?.updatePerfil
        ? await authService.updatePerfil(payload)
        : await api.patch('/auth/perfil/', payload);

      const userServidor = res?.data?.user || payload;
      const updated = {
        ...user,
        ...userServidor,
        token: userServidor.token || user.token,
      };

      localStorage.setItem('user', JSON.stringify(updated));
      window.dispatchEvent(new Event('auth-changed'));
      setUser(updated);
      setPerfilForm((prev) => ({
        ...prev,
        first_name: updated.first_name || '',
        last_name: updated.last_name || '',
        username: updated.username || '',
        email: updated.email || '',
        currentPassword: '',
        password: '',
        confirmPassword: '',
      }));
      toast.success(
        perfilForm.password
          ? t('configuracoes.toastSavedWithPass', 'Perfil e palavra-passe atualizados com sucesso!')
          : t('configuracoes.toastSaved', 'Dados do perfil atualizados com sucesso!')
      );
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        t('configuracoes.toastSaveError', 'Erro ao atualizar o perfil no servidor.');
      toast.error(msg);
    } finally {
      setSalvandoPerfil(false);
    }
  };

  const nomeCompletoExibido =
    `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Utilizador';
  const iniciaisUtilizador = (
    (user.first_name ? user.first_name.charAt(0) : '') +
    (user.last_name ? user.last_name.charAt(0) : '')
  ).toUpperCase() || (user.username ? user.username.slice(0, 2).toUpperCase() : 'US');

  return (
    <>
      <style>
        {`
        .confronto-kpi-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
          padding: 18px 20px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .confronto-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.06);
        }
        `}
      </style>

      {/* CABEÇALHO DA PÁGINA */}
      <div className="row mb-20">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
            <div>
              <h4 className="fw-800 color-dark mb-4" style={{ fontSize: 22, color: '#0f172a' }}>
                <i className="la la-cog text-primary mr-6"></i>{' '}
                {t('configuracoes.title', 'Definições da Empresa & Conta de Acesso')}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13.5 }}>
                {isOperadorFacturas
                  ? 'Atualize o seu nome, utilizador, email e palavra-passe de acesso ao sistema.'
                  : 'Atualize os dados da sua empresa, o seu nome, utilizador, palavra-passe e parâmetros fiscais.'}
              </p>
            </div>

            <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
              {isOperadorFacturas && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary d-flex align-items-center"
                  onClick={() => navigate('/facturas')}
                  style={{ borderRadius: 8, fontWeight: 700, fontSize: 13, padding: '8px 16px', gap: 6 }}
                >
                  <i className="la la-arrow-left" style={{ fontSize: 15 }}></i>
                  <span>Voltar ao Scanner de Facturas</span>
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-sm btn-primary d-flex align-items-center"
                  onClick={() => navigate('/admin-gestao')}
                  style={{
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    backgroundColor: '#2563eb',
                    borderColor: '#2563eb',
                    padding: '8px 16px',
                    gap: 6,
                  }}
                >
                  <i className="la la-shield-alt" style={{ fontSize: 16 }}></i>
                  <span>{t('navigation.admin', 'Painel de Administração')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FAIXA DE RESUMO DA EMPRESA + KPIS (OCULTO PARA OPERADOR EXCLUSIVO DE FACTURAS) */}
      {!isOperadorFacturas && (
        <>
          <div className="card card-default mb-20" style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#ffffff' }}>
            <div className="card-body p-16">
              <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 12 }}>
                <div className="d-flex align-items-center" style={{ gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      backgroundColor: '#2563eb',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 20,
                    }}
                  >
                    {empresaSelecionada?.nome ? empresaSelecionada.nome.charAt(0).toUpperCase() : 'E'}
                  </div>
                  <div>
                    <strong className="color-dark d-block" style={{ fontSize: 14 }}>
                      {empresaSelecionada?.nome || 'Selecione a Empresa'}
                    </strong>
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      NIF: {empresaSelecionada?.nif || '---'} · Regime de IVA:{' '}
                      {empresaSelecionada?.regime_nome || empresaSelecionada?.regime_iva || 'Geral'}
                    </span>
                  </div>
                </div>

                <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
                  {isAdmin ? (
                    <>
                      <select
                        className="form-control form-control-sm"
                        value={empresaId || ''}
                        onChange={(e) => atualizar && atualizar({ empresaId: e.target.value })}
                        style={{ minWidth: 240, height: 38, fontWeight: 600, fontSize: 13, background: '#ffffff' }}
                      >
                        {empresas.length === 0 ? (
                          <option value="">Nenhuma empresa cadastrada</option>
                        ) : (
                          empresas.map((emp) => (
                            <option key={emp.id} value={String(emp.id)}>
                              {emp.nome} ({emp.nif})
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary d-flex align-items-center"
                        onClick={() => navigate('/admin-gestao?aba=empresas&novaEmpresa=1')}
                        style={{
                          height: 38,
                          borderRadius: 8,
                          fontWeight: 700,
                          backgroundColor: '#2563eb',
                          borderColor: '#2563eb',
                          padding: '0 14px',
                          gap: 6,
                          whiteSpace: 'nowrap',
                          fontSize: 13,
                        }}
                        title="Cadastrar Nova Empresa"
                      >
                        <i className="la la-plus" style={{ fontSize: 15 }}></i>
                        <span>Nova Empresa</span>
                      </button>
                    </>
                  ) : (
                    <div
                      className="badge px-12 py-8 fw-700 d-flex align-items-center"
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #bfdbfe',
                        color: '#2563eb',
                        borderRadius: 8,
                        fontSize: 12.5,
                        gap: 6,
                      }}
                    >
                      <i className="la la-building" style={{ fontSize: 15 }}></i>
                      <span>
                        Empresa Ativa: <strong>{empresaSelecionada?.nome || 'Minha Empresa'}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 4 CARDS NUMÉRICOS / CADASTRAIS */}
          <div className="row mb-20" style={{ rowGap: 12 }}>
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #2563eb' }}>
                <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  NIF da Empresa
                </span>
                <div className="fw-800 color-dark" style={{ fontSize: 22 }}>
                  {empresaSelecionada?.nif || '---'}
                </div>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Contribuinte Fiscal AGT
                </span>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #2563eb' }}>
                <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Regime de IVA
                </span>
                <div className="fw-800" style={{ fontSize: 22, color: '#2563eb' }}>
                  {empresaSelecionada?.regime_iva || 'GERAL'}
                </div>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {empresaSelecionada?.regime_iva === 'SIMPLIFICADO'
                    ? 'Regime Simplificado (7%)'
                    : empresaSelecionada?.regime_iva === 'EXCLUSAO'
                    ? 'Regime de Exclusão'
                    : 'Taxa Geral 14%'}
                </span>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #2563eb' }}>
                <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Localização
                </span>
                <div className="fw-800 color-dark" style={{ fontSize: 22 }}>
                  {empresaSelecionada?.provincia || 'Luanda'}
                </div>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Município de {empresaSelecionada?.municipio || 'Luanda'}
                </span>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-lg-3">
              <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #2563eb' }}>
                <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Atividade Económica
                </span>
                <div
                  className="fw-800 text-truncate color-dark"
                  style={{ fontSize: 18, marginTop: 4 }}
                  title={empresaSelecionada?.atividade_principal}
                >
                  CAE {empresaSelecionada?.cae_principal || '46900'}
                </div>
                <span className="text-muted text-truncate d-block" style={{ fontSize: 12 }}>
                  {empresaSelecionada?.atividade_principal || 'Comércio e Serviços'}
                </span>
              </div>
            </div>
          </div>

          {/* SELEÇÃO DE ABAS (BOTÕES AZUIS ESPAÇADOS) */}
          <div className="d-flex align-items-center mb-20 flex-wrap" style={{ gap: 10 }}>
            <button
              type="button"
              className={`step-pill ${abaAtiva === 'empresa' ? 'active' : ''}`}
              onClick={() => mudarAba('empresa')}
            >
              <i className="la la-building"></i> 1. Dados da Empresa
            </button>
            <button
              type="button"
              className={`step-pill ${abaAtiva === 'perfil' ? 'active' : ''}`}
              onClick={() => mudarAba('perfil')}
            >
              <i className="la la-user-lock"></i> 2. O Meu Perfil, Nome & Palavra-passe
            </button>
            <button
              type="button"
              className={`step-pill ${abaAtiva === 'parametros' ? 'active' : ''}`}
              onClick={() => mudarAba('parametros')}
            >
              <i className="la la-balance-scale"></i> 3. Parâmetros Fiscais (AGT)
            </button>
          </div>
        </>
      )}

      {/* ABA 1: DADOS DA EMPRESA (EDITÁVEL) */}
      {!isOperadorFacturas && abaAtiva === 'empresa' && (
        <div className="row">
          <div className="col-12 col-lg-4 mb-20">
            <div className="card card-default mb-20" style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#ffffff' }}>
              <div className="card-header bg-white py-14 px-20 border-bottom">
                <span className="fw-700 color-dark" style={{ fontSize: 14 }}>
                  Resumo da Empresa Ativa
                </span>
              </div>
              <div className="card-body p-20">
                {empresaSelecionada ? (
                  <div className="p-16 rounded" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
                    <div className="d-flex align-items-center mb-12" style={{ gap: 10 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          backgroundColor: '#2563eb',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {empresaSelecionada.nome ? empresaSelecionada.nome.charAt(0).toUpperCase() : 'E'}
                      </div>
                      <div className="text-truncate">
                        <strong className="color-dark d-block text-truncate" style={{ fontSize: 13.5 }}>
                          {empresaSelecionada.nome}
                        </strong>
                        <span className="text-muted" style={{ fontSize: 12 }}>
                          NIF: {empresaSelecionada.nif}
                        </span>
                      </div>
                    </div>

                    <div className="pt-10 border-top d-flex justify-content-between align-items-center">
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        Regime de IVA:
                      </span>
                      <span className={`badge ${BADGE_REGIME[empresaSelecionada.regime_iva] || 'badge-primary'}`}>
                        {empresaSelecionada.regime_nome || empresaSelecionada.regime_iva}
                      </span>
                    </div>

                    <div className="pt-8 d-flex justify-content-between align-items-center">
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        Estado Cadastral:
                      </span>
                      <span className="badge badge-success">
                        {empresaSelecionada.estado || 'ATIVA'}
                      </span>
                    </div>

                    {empresaSelecionada.email && (
                      <div className="pt-8 d-flex justify-content-between align-items-center">
                        <span className="text-muted" style={{ fontSize: 12 }}>
                          Email:
                        </span>
                        <span className="fw-600 color-dark text-truncate ml-8" style={{ fontSize: 12 }}>
                          {empresaSelecionada.email}
                        </span>
                      </div>
                    )}

                    {empresaSelecionada.telefone && (
                      <div className="pt-8 d-flex justify-content-between align-items-center">
                        <span className="text-muted" style={{ fontSize: 12 }}>
                          Telefone:
                        </span>
                        <span className="fw-600 color-dark" style={{ fontSize: 12 }}>
                          {empresaSelecionada.telefone}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted mb-0">Nenhuma empresa selecionada.</p>
                )}

                <div className="mt-16 pt-16 border-top">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm w-100 d-flex align-items-center justify-content-center"
                    onClick={() => mudarAba('perfil')}
                    style={{ borderRadius: 8, fontWeight: 700, padding: '8px 14px', gap: 6 }}
                  >
                    <i className="la la-key" style={{ fontSize: 16 }}></i>
                    <span>Alterar Minha Senha ou Nome de Conta</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="card card-default" style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#ffffff' }}>
              <div
                className="card-header bg-white py-15 px-20 border-bottom d-flex justify-content-between align-items-center flex-wrap"
                style={{ gap: 10 }}
              >
                <div>
                  <h5 className="fw-700 color-dark mb-0" style={{ fontSize: 15 }}>
                    Ficha Cadastral, Nomes & Contactos da Empresa
                  </h5>
                  <span className="text-muted" style={{ fontSize: 12.5 }}>
                    Edite a denominação, nome comercial, contactos, endereço, atividade e contabilista responsável.
                  </span>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-xs btn-outline-primary d-flex align-items-center"
                    onClick={() => navigate('/admin-gestao?aba=empresas')}
                    style={{ borderRadius: 6, fontWeight: 600, padding: '6px 12px', fontSize: 12, gap: 5 }}
                  >
                    <i className="la la-building"></i>
                    <span>Gestão Global de Empresas</span>
                  </button>
                )}
              </div>

              <div className="card-body p-20">
                {carregandoEmpresa ? (
                  <p className="text-muted text-center py-30">A carregar dados da empresa...</p>
                ) : empresaSelecionada ? (
                  <form onSubmit={handleSalvarEmpresa}>
                    <div className="row" style={{ rowGap: 16 }}>
                      <div className="col-12 col-md-8">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          RAZÃO SOCIAL / NOME DA EMPRESA *
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          required
                          readOnly={isSomenteConsulta}
                          value={empresaForm.nome}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, nome: e.target.value })}
                          style={{ background: '#ffffff' }}
                        />
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          NIF (CONTRIBUINTE AGT) *
                        </label>
                        <input
                          type="text"
                          className="form-control fw-700 color-dark"
                          required
                          readOnly={isSomenteConsulta}
                          value={empresaForm.nif}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, nif: e.target.value })}
                          style={{ background: '#ffffff' }}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          NOME COMERCIAL / FANTASIA
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          readOnly={isSomenteConsulta}
                          placeholder="Ex: SCKJ Comércio & Serviços"
                          value={empresaForm.nome_comercial}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, nome_comercial: e.target.value })}
                          style={{ background: '#ffffff' }}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          TIPO DE ENTIDADE
                        </label>
                        <select
                          className="form-control"
                          disabled={isSomenteConsulta}
                          value={empresaForm.tipo_entidade}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, tipo_entidade: e.target.value })}
                          style={{ background: '#ffffff' }}
                        >
                          {TIPOS_ENTIDADE.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-12 col-md-8">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          ATIVIDADE PRINCIPAL
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          readOnly={isSomenteConsulta}
                          placeholder="Ex: Comércio Geral e Prestação de Serviços"
                          value={empresaForm.atividade_principal}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, atividade_principal: e.target.value })}
                          style={{ background: '#ffffff' }}
                        />
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          CÓDIGO CAE
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          readOnly={isSomenteConsulta}
                          placeholder="Ex: 46900"
                          value={empresaForm.cae_principal}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, cae_principal: e.target.value })}
                          style={{ background: '#ffffff' }}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          REGIME DE IVA (CIVA ANGOLA)
                        </label>
                        <select
                          className="form-control"
                          disabled={isSomenteConsulta}
                          value={empresaForm.regime_iva}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, regime_iva: e.target.value })}
                          style={{ background: '#ffffff' }}
                        >
                          <option value="GERAL">Regime Geral (14%)</option>
                          <option value="SIMPLIFICADO">Regime Simplificado (7%)</option>
                          <option value="EXCLUSAO">Regime de Exclusão / Não Sujeição</option>
                        </select>
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          REPARTIÇÃO FISCAL
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          readOnly={isSomenteConsulta}
                          placeholder="Ex: 1.ª Repartição Fiscal de Luanda"
                          value={empresaForm.reparticao_fiscal}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, reparticao_fiscal: e.target.value })}
                          style={{ background: '#ffffff' }}
                        />
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          PROVÍNCIA
                        </label>
                        <select
                          className="form-control"
                          disabled={isSomenteConsulta}
                          value={empresaForm.provincia || 'Luanda'}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, provincia: e.target.value })}
                          style={{ background: '#ffffff' }}
                        >
                          {PROVINCIAS_ANGOLA.map((prov) => (
                            <option key={prov} value={prov}>
                              {prov}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          MUNICÍPIO
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          readOnly={isSomenteConsulta}
                          placeholder="Ex: Luanda / Belas / Viana"
                          value={empresaForm.municipio}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, municipio: e.target.value })}
                          style={{ background: '#ffffff' }}
                        />
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          TELEFONE DA EMPRESA
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          readOnly={isSomenteConsulta}
                          placeholder="+244 9..."
                          value={empresaForm.telefone}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, telefone: e.target.value })}
                          style={{ background: '#ffffff' }}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          EMAIL CORPORATIVO
                        </label>
                        <input
                          type="email"
                          className="form-control"
                          readOnly={isSomenteConsulta}
                          placeholder="geral@empresa.co.ao"
                          value={empresaForm.email}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, email: e.target.value })}
                          style={{ background: '#ffffff' }}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          ENDEREÇO / SEDE SOCIAL
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          readOnly={isSomenteConsulta}
                          placeholder="Rua, Bairro, Edifício, N.º"
                          value={empresaForm.endereco}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, endereco: e.target.value })}
                          style={{ background: '#ffffff' }}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          CONTABILISTA RESPONSÁVEL (NOME)
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          readOnly={isSomenteConsulta}
                          placeholder="Nome completo do Contabilista (OCPCA)"
                          value={empresaForm.contabilista_nome}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, contabilista_nome: e.target.value })}
                          style={{ background: '#ffffff' }}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                          CONTACTO DO CONTABILISTA
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          readOnly={isSomenteConsulta}
                          placeholder="Telefone ou email do Contabilista"
                          value={empresaForm.contabilista_contacto}
                          onChange={(e) => setEmpresaForm({ ...empresaForm, contabilista_contacto: e.target.value })}
                          style={{ background: '#ffffff' }}
                        />
                      </div>

                      {!isSomenteConsulta && (
                        <div className="col-12 pt-10 d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
                          <button
                            type="submit"
                            className="btn btn-primary d-flex align-items-center"
                            disabled={salvandoEmpresa}
                            style={{
                              fontWeight: 700,
                              backgroundColor: '#2563eb',
                              borderColor: '#2563eb',
                              padding: '9px 20px',
                              borderRadius: 8,
                              gap: 6,
                            }}
                          >
                            <i className="la la-save" style={{ fontSize: 16 }}></i>
                            <span>{salvandoEmpresa ? 'A Guardar...' : 'Guardar Dados da Empresa'}</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-outline-primary d-flex align-items-center"
                            disabled={salvandoEmpresa}
                            onClick={() => setEmpresaForm(criarFormEmpresa(empresaSelecionada))}
                            style={{ fontWeight: 600, padding: '9px 18px', borderRadius: 8, gap: 6 }}
                          >
                            <i className="la la-undo" style={{ fontSize: 15 }}></i>
                            <span>Repor Valores</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </form>
                ) : (
                  <p className="text-muted text-center py-30">Nenhuma empresa selecionada.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: O MEU PERFIL, NOMES & PALAVRA-PASSE */}
      {(abaAtiva === 'perfil' || isOperadorFacturas) && (
        <div className="row">
          <div className="col-12 col-lg-4 mb-20">
            <div
              className="card card-default text-center p-30"
              style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#ffffff' }}
            >
              <div
                className="mx-auto mb-15"
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  backgroundColor: '#2563eb',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 800,
                }}
              >
                {iniciaisUtilizador}
              </div>
              <h5 className="fw-800 color-dark mb-4" style={{ fontSize: 17 }}>
                {nomeCompletoExibido}
              </h5>
              <div className="text-muted mb-10" style={{ fontSize: 12.5 }}>
                @{user.username || 'utilizador'}
              </div>
              <div className="mb-12">
                <span
                  className="badge px-12 py-5"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: '#ffffff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    borderRadius: 20,
                  }}
                >
                  {user.papel || user.role || (isAdmin ? 'Administrador' : 'Contabilista')}
                </span>
              </div>
              <p className="text-muted mb-0" style={{ fontSize: 12.5 }}>
                {user.email || 'Sem email configurado'}
              </p>
            </div>
          </div>

          <div className="col-12 col-lg-8">
            <div className="card card-default" style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#ffffff' }}>
              <div className="card-header bg-white py-15 px-20 border-bottom d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 10 }}>
                <div>
                  <h5 className="fw-700 color-dark mb-0" style={{ fontSize: 15 }}>
                    Dados Pessoais, Nome de Utilizador & Alteração de Palavra-passe
                  </h5>
                  <span className="text-muted" style={{ fontSize: 12.5 }}>
                    Altere o seu nome próprio, apelido, nome de acesso (login), email e palavra-passe diretamente na base de dados.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-xs btn-outline-primary d-flex align-items-center"
                  onClick={() => setMostrarSenhas((v) => !v)}
                  style={{ borderRadius: 6, fontWeight: 600, padding: '6px 12px', fontSize: 12, gap: 5 }}
                >
                  <i className={`la ${mostrarSenhas ? 'la-eye-slash' : 'la-eye'}`}></i>
                  <span>{mostrarSenhas ? 'Ocultar Senhas' : 'Mostrar Senhas'}</span>
                </button>
              </div>

              <div className="card-body p-20">
                <form onSubmit={handleSalvarPerfil}>
                  <div className="row" style={{ rowGap: 16 }}>
                    <div className="col-12 col-md-6">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        PRIMEIRO NOME
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex: João"
                        value={perfilForm.first_name}
                        onChange={(e) => setPerfilForm({ ...perfilForm, first_name: e.target.value })}
                        style={{ background: '#ffffff' }}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        SOBRENOME / APELIDO
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ex: Silva"
                        value={perfilForm.last_name}
                        onChange={(e) => setPerfilForm({ ...perfilForm, last_name: e.target.value })}
                        style={{ background: '#ffffff' }}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        NOME DE UTILIZADOR (LOGIN) *
                      </label>
                      <input
                        type="text"
                        className="form-control fw-600"
                        value={perfilForm.username}
                        onChange={(e) => setPerfilForm({ ...perfilForm, username: e.target.value })}
                        required
                        style={{ background: '#ffffff' }}
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
                        EMAIL DE CONTA & NOTIFICAÇÕES
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="utilizador@empresa.co.ao"
                        value={perfilForm.email}
                        onChange={(e) => setPerfilForm({ ...perfilForm, email: e.target.value })}
                        style={{ background: '#ffffff' }}
                      />
                    </div>

                    <div className="col-12 pt-8">
                      <div className="p-16 rounded" style={{ background: '#ffffff', border: '1px solid #bfdbfe' }}>
                        <div className="fw-700 mb-12 d-flex align-items-center" style={{ fontSize: 13.5, color: '#1e3a8a', gap: 6 }}>
                          <i className="la la-lock text-primary" style={{ fontSize: 17 }}></i>
                          <span>Alterar Palavra-passe (deixe em branco se quiser manter a atual)</span>
                        </div>

                        <div className="row" style={{ rowGap: 14 }}>
                          <div className="col-12 col-md-4">
                            <label className="fw-600 text-muted mb-4" style={{ fontSize: 11.5 }}>
                              PALAVRA-PASSE ATUAL
                            </label>
                            <input
                              type={mostrarSenhas ? 'text' : 'password'}
                              className="form-control"
                              placeholder="Senha atual"
                              autoComplete="current-password"
                              value={perfilForm.currentPassword}
                              onChange={(e) => setPerfilForm({ ...perfilForm, currentPassword: e.target.value })}
                              style={{ background: '#ffffff' }}
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <label className="fw-600 text-muted mb-4" style={{ fontSize: 11.5 }}>
                              NOVA PALAVRA-PASSE
                            </label>
                            <input
                              type={mostrarSenhas ? 'text' : 'password'}
                              className="form-control"
                              placeholder="Mínimo 6 caracteres"
                              autoComplete="new-password"
                              value={perfilForm.password}
                              onChange={(e) => setPerfilForm({ ...perfilForm, password: e.target.value })}
                              style={{ background: '#ffffff' }}
                            />
                          </div>

                          <div className="col-12 col-md-4">
                            <label className="fw-600 text-muted mb-4" style={{ fontSize: 11.5 }}>
                              CONFIRMAR NOVA PALAVRA-PASSE
                            </label>
                            <input
                              type={mostrarSenhas ? 'text' : 'password'}
                              className="form-control"
                              placeholder="Repita a nova senha"
                              autoComplete="new-password"
                              value={perfilForm.confirmPassword}
                              onChange={(e) => setPerfilForm({ ...perfilForm, confirmPassword: e.target.value })}
                              style={{ background: '#ffffff' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-12 pt-10 d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
                      <button
                        type="submit"
                        className="btn btn-primary d-flex align-items-center"
                        disabled={salvandoPerfil}
                        style={{
                          fontWeight: 700,
                          backgroundColor: '#2563eb',
                          borderColor: '#2563eb',
                          padding: '9px 20px',
                          borderRadius: 8,
                          gap: 6,
                        }}
                      >
                        <i className="la la-save" style={{ fontSize: 16 }}></i>
                        <span>{salvandoPerfil ? 'A Guardar...' : 'Guardar Perfil & Credenciais'}</span>
                      </button>

                      {(perfilForm.currentPassword || perfilForm.password || perfilForm.confirmPassword) && (
                        <button
                          type="button"
                          className="btn btn-outline-primary d-flex align-items-center"
                          onClick={() =>
                            setPerfilForm((prev) => ({
                              ...prev,
                              currentPassword: '',
                              password: '',
                              confirmPassword: '',
                            }))
                          }
                          style={{ fontWeight: 600, padding: '9px 16px', borderRadius: 8, gap: 6 }}
                        >
                          <i className="la la-times" style={{ fontSize: 15 }}></i>
                          <span>Limpar Senhas</span>
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: PARÂMETROS FISCAIS (AGT) */}
      {!isOperadorFacturas && abaAtiva === 'parametros' && (
        <div className="row">
          <div className="col-12">
            <Taxas />
          </div>
        </div>
      )}
    </>
  );
};

export default Configuracoes;
