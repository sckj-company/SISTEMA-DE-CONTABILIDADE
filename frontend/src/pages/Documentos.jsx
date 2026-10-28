import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { authHeaders, empresaService, API_BASE } from '../services/api';
import ConfirmModal from '../components/common/ConfirmModal';
import { usePeriodo, usePeriodoDaUrl } from '../context/PeriodoContext';

const PASTAS_ORGANIZACIONAIS = [
  { id: 'TODOS', nomePadrao: 'Todos os Documentos', icone: 'la la-folder-open', tipos: [] },
  { id: 'BALANCETES', nomePadrao: 'Balancetes PGC', icone: 'la la-book', tipos: ['BALANCETE'] },
  { id: 'AGT', nomePadrao: 'Declarações AGT (Modelo 7)', icone: 'la la-landmark', tipos: ['MODELO7', 'IMPOSTO_INDUSTRIAL', 'DECLARACAO_IRT'] },
  { id: 'OUTROS', nomePadrao: 'Outros Comprovativos', icone: 'la la-file-alt', tipos: ['FACTURA_VENDA', 'FACTURA_COMPRA', 'FOLHA_SALARIAL', 'FOLHA_SS', 'EXTRACTO_BANCARIO', 'COMPROVATIVOS', 'RETENCOES', 'OUTRO', 'DOSSIE_MENSAL'] },
];

const TIPOS_DOCUMENTO = [
  { valor: 'BALANCETE', pasta: 'BALANCETES', labelPadrao: 'Balancete de Verificação (PGC)' },
  { valor: 'MODELO7', pasta: 'AGT', labelPadrao: 'Declaração Modelo 7 da AGT (IVA)' },
  { valor: 'IMPOSTO_INDUSTRIAL', pasta: 'AGT', labelPadrao: 'Declaração de Imposto Industrial' },
  { valor: 'DECLARACAO_IRT', pasta: 'AGT', labelPadrao: 'Declaração de IRT' },
  { valor: 'FACTURA_VENDA', pasta: 'OUTROS', labelPadrao: 'Fatura de Venda (Emitida)' },
  { valor: 'FACTURA_COMPRA', pasta: 'OUTROS', labelPadrao: 'Fatura de Compra / Fornecedor' },
  { valor: 'FOLHA_SALARIAL', pasta: 'OUTROS', labelPadrao: 'Folha Salarial' },
  { valor: 'FOLHA_SS', pasta: 'OUTROS', labelPadrao: 'Guia da Segurança Social (INSS)' },
  { valor: 'EXTRACTO_BANCARIO', pasta: 'OUTROS', labelPadrao: 'Extrato Bancário' },
  { valor: 'COMPROVATIVOS', pasta: 'OUTROS', labelPadrao: 'Comprovativo de Pagamento' },
  { valor: 'RETENCOES', pasta: 'OUTROS', labelPadrao: 'Retenção na Fonte' },
  { valor: 'DOSSIE_MENSAL', pasta: 'OUTROS', labelPadrao: 'Dossiê Mensal Completo' },
  { valor: 'OUTRO', pasta: 'OUTROS', labelPadrao: 'Outro Documento Societário' },
];

const MESES = [
  { valor: '1', chave: 'january', nome: 'Janeiro' },
  { valor: '2', chave: 'february', nome: 'Fevereiro' },
  { valor: '3', chave: 'march', nome: 'Março' },
  { valor: '4', chave: 'april', nome: 'Abril' },
  { valor: '5', chave: 'may', nome: 'Maio' },
  { valor: '6', chave: 'june', nome: 'Junho' },
  { valor: '7', chave: 'july', nome: 'Julho' },
  { valor: '8', chave: 'august', nome: 'Agosto' },
  { valor: '9', chave: 'september', nome: 'Setembro' },
  { valor: '10', chave: 'october', nome: 'Outubro' },
  { valor: '11', chave: 'november', nome: 'Novembro' },
  { valor: '12', chave: 'december', nome: 'Dezembro' },
];

const SpinDots = () => (
  <div className="spin-dots-wrapper">
    <span className="atbd-spin-dots spin-lg">
      <span className="spin-dot badge-dot dot-primary"></span>
      <span className="spin-dot badge-dot dot-primary"></span>
      <span className="spin-dot badge-dot dot-primary"></span>
      <span className="spin-dot badge-dot dot-primary"></span>
    </span>
  </div>
);

const Documentos = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const fileInputRef = useRef(null);
  const dateLocale = { pt: 'pt-BR', en: 'en-US', zh: 'zh-CN' }[i18n.language?.substring(0, 2)] || 'pt-BR';
  const anoAtual = new Date().getFullYear();

  const [documentos, setDocumentos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = Boolean(currentUser.is_admin || currentUser.is_superuser || currentUser.is_staff);

  // Pastas e Filtros
  const [pastaAtiva, setPastaAtiva] = useState('TODOS');
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroMes, setFiltroMes] = useState('todos');
  const [filtroAno, setFiltroAno] = useState('todos');

  // Upload Form / Dropzone
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadTipo, setUploadTipo] = useState('BALANCETE');
  const [docName, setDocName] = useState('');
  const [detectando, setDetectando] = useState(false);
  const [detecaoInfo, setDetecaoInfo] = useState(null);
  const [docApagar, setDocApagar] = useState(null);

  const { empresaId, ano, mes, atualizar } = usePeriodo();
  usePeriodoDaUrl();

  const getTipoLabel = useCallback(
    (valor, fallback) => {
      const achado = TIPOS_DOCUMENTO.find((tItem) => tItem.valor === valor);
      return achado ? achado.labelPadrao : fallback || valor;
    },
    []
  );

  const getMesNome = useCallback(
    (valor) => {
      const mObj = MESES.find((m) => m.valor === String(valor));
      return mObj ? t(`months.${mObj.chave}`, mObj.nome) : valor;
    },
    [t]
  );

  // Carregar lista de empresas
  const carregarEmpresas = useCallback(() => {
    return empresaService
      .getAll()
      .then((res) => {
        const lista = Array.isArray(res.data) ? res.data : res.data.results || [];
        setEmpresas(lista);
        if (lista.length > 0) {
          const existe = lista.some((e) => String(e.id) === String(empresaId));
          if (!existe) {
            const sckj = lista.find((e) => e.nif === '5002830280');
            atualizar({ empresaId: String(sckj ? sckj.id : lista[0].id) });
          }
        } else {
          atualizar({ empresaId: '' });
        }
        return lista;
      })
      .catch(() => {
        setEmpresas([]);
        return [];
      });
  }, [empresaId, atualizar]);

  useEffect(() => {
    carregarEmpresas();
  }, [carregarEmpresas]);

  const fetchDocumentos = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/documentos/listar/`, { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setDocumentos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      toast.error(t('common.serverError', 'Erro ao aceder ao arquivo digital.'));
      setDocumentos([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDocumentos();
  }, [fetchDocumentos]);

  // Processamento e auto-deteção do ficheiro selecionado
  const processarFicheiro = async (file) => {
    if (!file) return;
    setSelectedFile(file);
    setDocName(file.name);
    setDetectando(true);
    setDetecaoInfo(null);
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      const res = await fetch(`${API_BASE}/documentos/detectar/`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setDetecaoInfo(data);
        if (data.tipo) {
          setUploadTipo(data.tipo);
        }
        if (data.empresa_recem_criada) {
          await carregarEmpresas();
          toast.success(
            `✨ ${data.mensagem_cadastro || `Nova empresa pré-cadastrada a partir do documento: ${data.empresa_nome} (NIF: ${data.empresa_nif})`}`,
            { autoClose: 7000 }
          );
        }
        if (data.empresa_id) {
          atualizar({
            empresaId: String(data.empresa_id),
            ano: data.ano ? String(data.ano) : undefined,
            mes: data.mes ? String(data.mes) : undefined,
          });
        } else if (data.ano && data.mes) {
          atualizar({
            ano: String(data.ano),
            mes: String(data.mes),
          });
        }
        if (!data.empresa_recem_criada) {
          toast.info(
            `⚡ Detetado: ${data.tipo_nome || data.tipo} ${data.empresa_nome ? '· ' + data.empresa_nome : ''} ${data.mes && data.ano ? `(${data.mes}/${data.ano})` : ''}`,
            { autoClose: 4000 }
          );
        }
      }
    } catch (err) {
      console.warn('Erro ao autodetectar ficheiro:', err);
    } finally {
      setDetectando(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processarFicheiro(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processarFicheiro(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.warning(t('archive.notifications.selectFileWarn', 'Por favor selecione um ficheiro para arquivar.'));
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('arquivo', selectedFile);
    formData.append('tipo', uploadTipo || 'OUTRO');
    formData.append('empresa_id', empresaId || 'auto');
    formData.append('ano', ano);
    formData.append('mes', mes);
    if (docName) {
      formData.append('nome', docName);
    }

    try {
      const response = await fetch(`${API_BASE}/documentos/upload/`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.documento?.empresa_recem_criada) {
          toast.success(data.documento.mensagem_cadastro || 'Empresa pré-cadastrada automaticamente com sucesso!');
        } else {
          toast.success(t('archive.notifications.uploadSuccess', 'Documento arquivado com sucesso no repositório!'));
        }
        if (data.documento?.empresa) {
          atualizar({ empresaId: String(data.documento.empresa) });
        }
        setSelectedFile(null);
        setDocName('');
        setDetecaoInfo(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        carregarEmpresas();
        fetchDocumentos();
      } else if (response.status === 409) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || t('archive.notifications.duplicateError', 'Já existe um documento com este nome para este período.'));
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || t('common.error', 'Erro ao carregar documento.'));
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error(t('common.serverError', 'Erro de comunicação com o servidor.'));
    } finally {
      setUploading(false);
    }
  };

  const cancelarUpload = () => {
    setSelectedFile(null);
    setDocName('');
    setDetecaoInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filtragem dos documentos
  const documentosFiltrados = useMemo(() => {
    return documentos.filter((doc) => {
      if (empresaId && String(doc.empresa) !== String(empresaId)) {
        return false;
      }
      if (filtroTipo !== 'todos') {
        if (String(doc.tipo) !== String(filtroTipo)) {
          return false;
        }
      } else if (pastaAtiva !== 'TODOS') {
        const pastaObj = PASTAS_ORGANIZACIONAIS.find((p) => p.id === pastaAtiva);
        if (pastaObj && !pastaObj.tipos.includes(doc.tipo)) {
          return false;
        }
      }
      if (filtroAno !== 'todos' && String(doc.ano) !== String(filtroAno)) {
        return false;
      }
      if (filtroMes !== 'todos' && String(doc.mes) !== String(filtroMes)) {
        return false;
      }
      if (termoBusca.trim()) {
        const termo = termoBusca.toLowerCase();
        const nome = (doc.nome_arquivo || '').toLowerCase();
        const tipoLabel = (getTipoLabel(doc.tipo, doc.tipo) || '').toLowerCase();
        if (!nome.includes(termo) && !tipoLabel.includes(termo)) {
          return false;
        }
      }
      return true;
    });
  }, [documentos, empresaId, pastaAtiva, filtroTipo, filtroAno, filtroMes, termoBusca, getTipoLabel]);

  // Contadores por pasta para a empresa ativa
  const contadoresPastas = useMemo(() => {
    const docsDaEmpresa = empresaId
      ? documentos.filter((d) => String(d.empresa) === String(empresaId))
      : documentos;
    const mapa = { TODOS: docsDaEmpresa.length };
    PASTAS_ORGANIZACIONAIS.forEach((p) => {
      if (p.id !== 'TODOS') {
        mapa[p.id] = docsDaEmpresa.filter((d) => p.tipos.includes(d.tipo)).length;
      }
    });
    return mapa;
  }, [documentos, empresaId]);

  const handleDownload = (doc) => {
    if (!doc.arquivo_url) {
      toast.error(t('documentos.notAvailableDownload', 'Ficheiro não disponível para descarregar.'));
      return;
    }
    const link = document.createElement('a');
    link.href = doc.arquivo_url;
    link.download = doc.nome_arquivo || 'documento';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleView = (doc) => {
    if (!doc.arquivo_url) {
      toast.error(t('documentos.notAvailableView', 'Ficheiro não disponível para visualização.'));
      return;
    }
    window.open(doc.arquivo_url, '_blank');
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/documentos/${id}/`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (response.ok) {
        toast.success(t('archive.notifications.deleteSuccess', 'Documento removido do arquivo com sucesso.'));
        setDocApagar(null);
        fetchDocumentos();
      } else {
        toast.error(t('archive.notifications.deleteError', 'Erro ao eliminar documento.'));
      }
    } catch (error) {
      console.error('Erro ao apagar:', error);
      toast.error(t('common.serverError', 'Erro de ligação ao servidor.'));
    }
  };

  const empresaAtual = empresas.find((e) => String(e.id) === String(empresaId));

  const anosDisponiveis = [anoAtual, anoAtual - 1, 2026, 2025, 2024, 2023]
    .filter((v, i, a) => a.indexOf(v) === i);

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

      {/* CABEÇALHO DA PÁGINA COM NAVEGAÇÃO LIMPA */}
      <div className="row mb-20 pt-10">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 14 }}>
            <div>
              <h4 className="fw-800 mb-4" style={{ fontSize: 22, color: '#0f172a' }}>
                <i className="la la-folder-open mr-6" style={{ color: '#2563eb' }}></i>{' '}
                {t('archive.title', 'Arquivo Digital & Repositório de Documentos')}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13.5 }}>
                Guarda permanente e recuperação rápida de balancetes, declarações Modelo 7 e comprovativos fiscais da empresa.
              </p>
            </div>

            <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={fetchDocumentos}
                disabled={loading}
                style={{ fontWeight: 700, fontSize: 13, padding: '8px 16px' }}
              >
                <i className={`la la-sync mr-4 ${loading ? 'la-spin' : ''}`}></i>
                {t('archive.refresh', 'Atualizar Arquivo')}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => navigate('/confronto')}
                style={{ fontWeight: 700, fontSize: 13, padding: '8px 16px' }}
              >
                <i className="la la-balance-scale mr-4"></i> Ir para Confronto com IA &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FAIXA DE PERÍODO E EMPRESA EM CONTEXTO */}
      <div className="card card-default mb-20" style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#ffffff' }}>
        <div className="card-body p-16 bg-white">
          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 12 }}>
            <div className="d-flex align-items-center" style={{ gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 17,
                }}
              >
                {empresaAtual?.nome ? empresaAtual.nome.charAt(0).toUpperCase() : 'E'}
              </div>
              <div>
                <strong className="color-dark d-block" style={{ fontSize: 14 }}>
                  {empresaAtual?.nome || 'Selecione uma Empresa'}
                </strong>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  NIF: {empresaAtual?.nif || '---'} · Regime: {empresaAtual?.regime_nome || empresaAtual?.regime_iva || 'Geral'}
                </span>
              </div>
            </div>

            <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
              {isAdmin && empresas.length > 1 && (
                <div>
                  <select
                    className="form-control form-control-sm"
                    value={empresaId}
                    onChange={(e) => atualizar({ empresaId: e.target.value })}
                    style={{ minWidth: 200, height: 36, fontWeight: 600, fontSize: 12.5 }}
                  >
                    {empresas.map((emp) => (
                      <option key={emp.id} value={String(emp.id)}>
                        {emp.nome} ({emp.nif})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <select
                  className="form-control form-control-sm"
                  value={filtroAno}
                  onChange={(e) => setFiltroAno(e.target.value)}
                  style={{ minWidth: 120, height: 36, fontSize: 12.5 }}
                >
                  <option value="todos">Todos os Anos</option>
                  {anosDisponiveis.map((y) => (
                    <option key={y} value={String(y)}>
                      Ano {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  className="form-control form-control-sm"
                  value={filtroMes}
                  onChange={(e) => setFiltroMes(e.target.value)}
                  style={{ minWidth: 130, height: 36, fontSize: 12.5 }}
                >
                  <option value="todos">Todos os Meses</option>
                  {MESES.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 CARDS KPIS EM FUNDO BRANCO PURO */}
      <div className="row mb-20" style={{ rowGap: 14 }}>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #2563eb' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total no Repositório
            </span>
            <div className="fw-800" style={{ fontSize: 26, color: '#0f172a' }}>
              {documentosFiltrados.length}{' '}
              <span className="fs-13 text-muted fw-normal">ficheiros</span>
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Preservados no arquivo digital
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #2563eb' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Balancetes de Verificação
            </span>
            <div className="fw-800" style={{ fontSize: 26, color: '#2563eb' }}>
              {contadoresPastas.BALANCETES || 0}{' '}
              <span className="fs-13 text-muted fw-normal">PGC</span>
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Contabilidade e diários
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #2563eb' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Declarações AGT (IVA)
            </span>
            <div className="fw-800" style={{ fontSize: 26, color: '#2563eb' }}>
              {contadoresPastas.AGT || 0}{' '}
              <span className="fs-13 text-muted fw-normal">Modelo 7</span>
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              IVA e impostos declarados
            </span>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-lg-3">
          <div className="confronto-kpi-card h-100" style={{ borderTop: '3px solid #2563eb' }}>
            <span className="text-muted fw-700 d-block mb-4" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Outros Comprovativos
            </span>
            <div className="fw-800" style={{ fontSize: 26, color: '#0f172a' }}>
              {contadoresPastas.OUTROS || 0}{' '}
              <span className="fs-13 text-muted fw-normal">anexos</span>
            </div>
            <span className="text-muted" style={{ fontSize: 12 }}>
              Faturas, bancos e contratos
            </span>
          </div>
        </div>
      </div>

      {/* ZONA RÁPIDA DE ARQUIVAMENTO (MESMA ESTÉTICA BRANCA + AZUL DO SISTEMA) */}
      <div className="card card-default mb-20" style={{ border: '1px solid #e2e8f0', borderRadius: 14, background: '#ffffff' }}>
        <div className="card-header bg-white py-14 px-20 border-bottom d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
          <h5 className="fw-700 mb-0" style={{ fontSize: 15, color: '#0f172a' }}>
            <i className="la la-cloud-upload-alt mr-1" style={{ color: '#2563eb' }}></i> Carregar Novo Ficheiro para o Arquivo
          </h5>
          <span className="text-muted" style={{ fontSize: 12 }}>
            Deteção inteligente de empresa, exercício fiscal e modelo
          </span>
        </div>
        <div className="card-body p-20 bg-white">
          {!selectedFile ? (
            <div
              className={`upload-drop-card ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="d-none"
                accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
              <div className="upload-icon-circle">
                <i className="la la-cloud-upload-alt"></i>
              </div>
              <h6 className="fw-700 mb-4" style={{ fontSize: 15, color: '#0f172a' }}>
                Arraste qualquer ficheiro para aqui ou clique para selecionar
              </h6>
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                Suporta ficheiros PDF e Excel (.xlsx). O sistema categoriza e associa automaticamente à empresa.
              </p>
            </div>
          ) : (
            <form onSubmit={handleUploadSubmit}>
              <div className="upload-drop-card has-file text-left p-20">
                <div className="d-flex align-items-center justify-content-between mb-15 flex-wrap" style={{ gap: 12 }}>
                  <div className="d-flex align-items-center" style={{ gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        border: '2px solid #bfdbfe',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        flexShrink: 0,
                      }}
                    >
                      <i className="la la-check"></i>
                    </div>
                    <div>
                      <strong className="d-block" style={{ fontSize: 14.5, color: '#0f172a' }}>
                        {selectedFile.name}
                      </strong>
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        {(selectedFile.size / 1024).toFixed(1)} KB
                        {detectando && (
                          <span className="ml-2" style={{ color: '#2563eb', fontWeight: 600 }}>
                            <i className="la la-spinner la-spin"></i> A analisar documento...
                          </span>
                        )}
                        {detecaoInfo && !detectando && (
                          <>
                            <span className="ml-2 font-weight-bold" style={{ color: '#2563eb' }}>
                              <i className="la la-check"></i> {detecaoInfo.tipo_nome || detecaoInfo.tipo}
                            </span>
                            {detecaoInfo.empresa_recem_criada && (
                              <span
                                className="badge ml-2"
                                style={{
                                  backgroundColor: '#ffffff',
                                  color: '#2563eb',
                                  border: '1px solid #bfdbfe',
                                  fontSize: 11,
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                }}
                              >
                                Nova Empresa Pré-Cadastrada
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={cancelarUpload}
                      disabled={uploading}
                      style={{ fontWeight: 700, padding: '7px 14px' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-sm btn-primary"
                      disabled={uploading}
                      style={{ fontWeight: 700, padding: '7px 16px' }}
                    >
                      {uploading ? (
                        <>
                          <i className="la la-spinner la-spin mr-1"></i> A Guardar...
                        </>
                      ) : (
                        <>
                          <i className="la la-shield-alt mr-1"></i> Guardar no Arquivo Permanente
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="row" style={{ rowGap: 10 }}>
                  <div className="col-12 col-md-4">
                    <label className="text-muted fw-600 mb-2" style={{ fontSize: 11.5 }}>
                      EMPRESA ASSOCIADA
                    </label>
                    {isAdmin && empresas.length > 1 ? (
                      <select
                        className="form-control form-control-sm"
                        value={empresaId || ''}
                        onChange={(e) => atualizar({ empresaId: e.target.value })}
                      >
                        <option value="">✨ Deteção Automática (Extrair do Documento)</option>
                        {empresas.map((emp) => (
                          <option key={emp.id} value={String(emp.id)}>
                            {emp.nome} ({emp.nif})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div
                        className="form-control form-control-sm bg-white fw-600 text-truncate d-flex align-items-center"
                        style={{ height: 34, fontSize: 12.5, border: '1px solid #bfdbfe', color: '#0f172a' }}
                      >
                        <i className="la la-building mr-1" style={{ color: '#2563eb' }}></i>
                        <span className="text-truncate">
                          {empresaAtual?.nome || 'Empresa Vinculada'} (NIF: {empresaAtual?.nif || '---'})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="col-12 col-md-4">
                    <label className="text-muted fw-600 mb-2" style={{ fontSize: 11.5 }}>
                      CATEGORIA DO DOCUMENTO
                    </label>
                    <select
                      className="form-control form-control-sm"
                      value={uploadTipo}
                      onChange={(e) => setUploadTipo(e.target.value)}
                      required
                    >
                      {TIPOS_DOCUMENTO.map((tItem) => (
                        <option key={tItem.valor} value={tItem.valor}>
                          {tItem.labelPadrao}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-6 col-md-2">
                    <label className="text-muted fw-600 mb-2" style={{ fontSize: 11.5 }}>
                      ANO
                    </label>
                    <select
                      className="form-control form-control-sm"
                      value={ano}
                      onChange={(e) => atualizar({ ano: e.target.value })}
                    >
                      {anosDisponiveis.map((y) => (
                        <option key={y} value={String(y)}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-6 col-md-2">
                    <label className="text-muted fw-600 mb-2" style={{ fontSize: 11.5 }}>
                      MÊS
                    </label>
                    <select
                      className="form-control form-control-sm"
                      value={mes}
                      onChange={(e) => atualizar({ mes: e.target.value })}
                    >
                      {MESES.map((m) => (
                        <option key={m.valor} value={m.valor}>
                          {m.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* NAVEGAÇÃO POR CATEGORIAS (BOTÕES AZUIS SEPARADOS) */}
      <div className="d-flex align-items-center justify-content-between mb-15 flex-wrap" style={{ gap: 12 }}>
        <div className="d-flex flex-wrap align-items-center" style={{ gap: 10 }}>
          {PASTAS_ORGANIZACIONAIS.map((pasta) => {
            const count = contadoresPastas[pasta.id] || 0;
            const isActive = pastaAtiva === pasta.id;
            return (
              <button
                key={pasta.id}
                type="button"
                className={`step-pill ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setPastaAtiva(pasta.id);
                  setFiltroTipo('todos');
                }}
              >
                <i className={pasta.icone} style={{ fontSize: 15 }}></i>
                <span>{pasta.nomePadrao}</span>
                <span
                  className="badge"
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#2563eb',
                    border: isActive ? 'none' : '1px solid #bfdbfe',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 10,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* BARRA DE PESQUISA E FILTROS DE DOCUMENTOS */}
        <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
          {/* PESQUISA RÁPIDA */}
          <div style={{ minWidth: 200, maxWidth: 260 }}>
            <div className="input-group">
              <span className="input-group-text bg-white border-right-0" style={{ border: '1px solid #cbd5e1' }}>
                <i className="la la-search" style={{ color: '#2563eb' }}></i>
              </span>
              <input
                type="text"
                className="form-control border-left-0"
                placeholder="Pesquisar documento..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                style={{ height: 36, fontSize: 13 }}
              />
              {termoBusca && (
                <button
                  type="button"
                  className="btn btn-outline-primary btn-xs ml-2"
                  style={{ height: 36, padding: '0 10px' }}
                  onClick={() => setTermoBusca('')}
                  title="Limpar pesquisa"
                >
                  <i className="la la-times"></i>
                </button>
              )}
            </div>
          </div>

          {/* FILTRO: TIPO DE DOCUMENTO */}
          <div style={{ minWidth: 165 }}>
            <select
              className="form-control form-control-sm"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              style={{ height: 36, fontSize: 12.5 }}
              title="Filtrar por tipo de documento"
            >
              <option value="todos">Todos os Tipos</option>
              {TIPOS_DOCUMENTO.map((tItem) => (
                <option key={tItem.valor} value={tItem.valor}>
                  {tItem.labelPadrao}
                </option>
              ))}
            </select>
          </div>

          {/* FILTRO: ANO */}
          <div style={{ minWidth: 110 }}>
            <select
              className="form-control form-control-sm"
              value={filtroAno}
              onChange={(e) => setFiltroAno(e.target.value)}
              style={{ height: 36, fontSize: 12.5 }}
              title="Filtrar por ano"
            >
              <option value="todos">Todos os Anos</option>
              {anosDisponiveis.map((y) => (
                <option key={y} value={String(y)}>
                  Ano {y}
                </option>
              ))}
            </select>
          </div>

          {/* FILTRO: MÊS */}
          <div style={{ minWidth: 125 }}>
            <select
              className="form-control form-control-sm"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              style={{ height: 36, fontSize: 12.5 }}
              title="Filtrar por mês"
            >
              <option value="todos">Todos os Meses</option>
              {MESES.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          {/* BOTÃO LIMPAR FILTROS */}
          {(termoBusca || filtroTipo !== 'todos' || filtroAno !== 'todos' || filtroMes !== 'todos' || pastaAtiva !== 'TODOS') && (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary d-flex align-items-center"
              style={{ height: 36, fontSize: 12, padding: '0 14px', fontWeight: 700 }}
              onClick={() => {
                setTermoBusca('');
                setFiltroTipo('todos');
                setFiltroAno('todos');
                setFiltroMes('todos');
                setPastaAtiva('TODOS');
              }}
              title="Limpar todos os filtros aplicados"
            >
              <i className="la la-filter mr-1"></i> Limpar
            </button>
          )}
        </div>
      </div>

      {/* TABELA DE FICHEIROS EM FUNDO BRANCO PURO */}
      <div className="card card-default" style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#ffffff' }}>
        <div className="card-body p-0 bg-white">
          {loading ? (
            <div className="text-center py-40">
              <SpinDots />
              <p className="text-muted mt-10" style={{ fontSize: 13 }}>
                A aceder ao repositório de documentos...
              </p>
            </div>
          ) : documentosFiltrados.length === 0 ? (
            <div className="text-center py-50 px-20">
              <div className="upload-icon-circle">
                <i className="la la-folder-open"></i>
              </div>
              <h5 className="fw-700 mb-6" style={{ fontSize: 16, color: '#0f172a' }}>
                Nenhum documento encontrado com os filtros selecionados
              </h5>
              <p className="text-muted mb-15" style={{ fontSize: 13 }}>
                Tente ajustar os filtros de tipo, ano, mês ou limpar a pesquisa para encontrar ficheiros.
              </p>
              {(termoBusca || filtroTipo !== 'todos' || filtroAno !== 'todos' || filtroMes !== 'todos' || pastaAtiva !== 'TODOS') && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => {
                    setTermoBusca('');
                    setFiltroTipo('todos');
                    setFiltroAno('todos');
                    setFiltroMes('todos');
                    setPastaAtiva('TODOS');
                  }}
                >
                  <i className="la la-filter mr-1"></i> Limpar Filtros
                </button>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: 13, background: '#ffffff' }}>
                <thead style={{ backgroundColor: '#ffffff' }}>
                  <tr>
                    <th style={{ width: '40%', padding: '14px 18px', fontWeight: 700, color: '#334155' }}>
                      Documento Arquivado ({documentosFiltrados.length})
                    </th>
                    <th style={{ width: '18%', padding: '14px 18px', fontWeight: 700, color: '#334155' }}>
                      Categoria
                    </th>
                    <th style={{ width: '12%', padding: '14px 18px', fontWeight: 700, color: '#334155', textAlign: 'center' }}>
                      Período
                    </th>
                    <th style={{ width: '12%', padding: '14px 18px', fontWeight: 700, color: '#334155', textAlign: 'center' }}>
                      Data
                    </th>
                    <th style={{ width: '18%', padding: '14px 18px', fontWeight: 700, color: '#334155', textAlign: 'right' }}>
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {documentosFiltrados.map((doc) => {
                    const labelTipo = getTipoLabel(doc.tipo, doc.tipo);
                    const mesTexto = getMesNome(doc.mes);

                    const isPdf = (doc.nome_arquivo || '').toLowerCase().endsWith('.pdf');
                    const isExcel =
                      (doc.nome_arquivo || '').toLowerCase().endsWith('.xlsx') ||
                      (doc.nome_arquivo || '').toLowerCase().endsWith('.xls');

                    return (
                      <tr key={doc.id}>
                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                          <div className="d-flex align-items-center" style={{ gap: 12 }}>
                            <span
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                backgroundColor: '#ffffff',
                                border: '1px solid #bfdbfe',
                                color: '#2563eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 20,
                                flexShrink: 0,
                              }}
                            >
                              <i className={isPdf ? 'la la-file-pdf' : isExcel ? 'la la-file-excel' : 'la la-file-alt'}></i>
                            </span>
                            <div>
                              <strong className="d-block" style={{ fontSize: 13.5, color: '#0f172a' }}>
                                {doc.nome_arquivo}
                              </strong>
                              <span className="text-muted" style={{ fontSize: 11.5 }}>
                                {doc.empresa_nome || empresaAtual?.nome || 'Empresa'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#ffffff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              padding: '5px 10px',
                              borderRadius: 6,
                            }}
                          >
                            {labelTipo}
                          </span>
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <strong style={{ fontSize: 12.5, color: '#0f172a' }}>
                            {mesTexto} / {doc.ano}
                          </strong>
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <span className="text-muted" style={{ fontSize: 12 }}>
                            {doc.created_at
                              ? new Date(doc.created_at).toLocaleDateString(dateLocale)
                              : '---'}
                          </span>
                        </td>

                        <td style={{ padding: '14px 18px', textAlign: 'right', verticalAlign: 'middle' }}>
                          <div className="d-inline-flex align-items-center" style={{ gap: 8 }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              title="Confrontar este documento"
                              onClick={() => navigate(`/confronto?empresa=${doc.empresa}&ano=${doc.ano}&mes=${doc.mes}`)}
                              style={{ padding: '5px 10px', borderRadius: 6, fontWeight: 700, fontSize: 11.5 }}
                            >
                              <i className="la la-bolt mr-1"></i> Confrontar
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-xs"
                              title="Visualizar documento"
                              onClick={() => handleView(doc)}
                              style={{ padding: '5px 9px', borderRadius: 6 }}
                            >
                              <i className="la la-eye"></i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-xs"
                              title="Descarregar ficheiro"
                              onClick={() => handleDownload(doc)}
                              style={{ padding: '5px 9px', borderRadius: 6 }}
                            >
                              <i className="la la-download"></i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-xs"
                              title="Eliminar documento"
                              onClick={() => setDocApagar(doc)}
                              style={{ padding: '5px 9px', borderRadius: 6 }}
                            >
                              <i className="la la-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE ELIMINAÇÃO */}
      <ConfirmModal
        show={Boolean(docApagar)}
        onClose={() => setDocApagar(null)}
        onConfirm={() => docApagar && handleDelete(docApagar.id)}
        title={t('archive.deleteModal.title', 'Eliminar Documento do Arquivo')}
        subtitle={t('archive.deleteModal.subtitle', 'Aviso de salvaguarda')}
        confirmLabel={t('archive.deleteModal.confirm', 'Sim, Eliminar Documento')}
        confirmClass="btn-primary"
      >
        <p className="text-muted mb-0" style={{ fontSize: 13 }}>
          {t('archive.deleteModal.message', {
            name: docApagar?.nome_arquivo,
            defaultValue: `Tem certeza de que deseja eliminar o documento "${docApagar?.nome_arquivo}"?`,
          })}
        </p>
      </ConfirmModal>
    </>
  );
};

export default Documentos;
