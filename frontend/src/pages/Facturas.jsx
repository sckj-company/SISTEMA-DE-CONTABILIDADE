import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { facturaService } from '../services/api';
import { usePeriodo, usePeriodoDaUrl } from '../context/PeriodoContext';
import ConfirmModal from '../components/common/ConfirmModal';

const MESES = [
  { valor: 'todos', nome: 'Todos os Meses' },
  { valor: '1', nome: 'Janeiro' },
  { valor: '2', nome: 'Fevereiro' },
  { valor: '3', nome: 'Março' },
  { valor: '4', nome: 'Abril' },
  { valor: '5', nome: 'Maio' },
  { valor: '6', nome: 'Junho' },
  { valor: '7', nome: 'Julho' },
  { valor: '8', nome: 'Agosto' },
  { valor: '9', nome: 'Setembro' },
  { valor: '10', nome: 'Outubro' },
  { valor: '11', nome: 'Novembro' },
  { valor: '12', nome: 'Dezembro' },
];

const formatarKz = (val) => {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kz';
};

const formatarDocUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '127.0.0.1';
  const proto = typeof window !== 'undefined' && window.location.protocol ? window.location.protocol : 'http:';
  return `${proto}//${host}:8000${url.startsWith('/') ? '' : '/'}${url}`;
};

const Facturas = () => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const cameraInputFallbackRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const { empresaId, ano, mes, empresaAtual, atualizar } = usePeriodo();
  usePeriodoDaUrl();

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isOperador = Boolean(user.is_operador_facturas || user.papel === 'Operador de Facturação');

  const [facturas, setFacturas] = useState([]);
  const [estatisticas, setEstatisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanProgresso, setScanProgresso] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Câmara e Captura de Fotos
  const [cameraAberta, setCameraAberta] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [fotoCapturada, setFotoCapturada] = useState(null);
  const [cameraErro, setCameraErro] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');

  // Filtros
  const [filtroMes, setFiltroMes] = useState(mes ? String(mes) : 'todos');
  const [filtroConformidade, setFiltroConformidade] = useState('todos');
  const [busca, setBusca] = useState('');

  // Modais
  const [facturaDetalhe, setFacturaDetalhe] = useState(null);
  const [facturaApagar, setFacturaApagar] = useState(null);
  const [lancandoId, setLancandoId] = useState(null);
  const [exportando, setExportando] = useState(false);

  // Sincronizar filtro de mês com o contexto global se mudar
  useEffect(() => {
    if (mes) setFiltroMes(String(mes));
  }, [mes]);

  const carregarFacturas = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        empresa_id: empresaId || undefined,
        ano: ano || undefined,
        mes: filtroMes !== 'todos' ? filtroMes : undefined,
        conformidade: filtroConformidade !== 'todos' ? filtroConformidade : undefined,
        search: busca || undefined,
      };
      const res = await facturaService.listar(params);
      setFacturas(res.data.facturas || []);
      setEstatisticas(res.data.estatisticas || null);
    } catch (err) {
      console.error('Erro ao listar facturas:', err);
      toast.error(t('facturasUi.loadError', 'Não foi possível carregar as facturas.'));
    } finally {
      setLoading(false);
    }
  }, [empresaId, ano, filtroMes, filtroConformidade, busca, t]);

  useEffect(() => {
    carregarFacturas();
  }, [carregarFacturas]);

  // Gestão da Câmara (Webcam de Computador e Câmaras de Smartphones/Tablets)
  const abrirCamera = async (modo = 'environment') => {
    setCameraAberta(true);
    setFotoCapturada(null);
    setCameraErro(null);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((tr) => tr.stop());
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          t(
            'facturasUi.browserNoCameraSupport',
            'O seu navegador não suporta captura direta por câmara. Use a opção de ficheiro ou câmara do dispositivo.'
          )
        );
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: modo, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch (e1) {
        // Fallback genérico se a restrição de facingMode falhar
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      setCameraStream(stream);
      setFacingMode(modo);
    } catch (err) {
      console.error('Erro ao aceder à câmara:', err);
      setCameraErro(err.message || t('facturasUi.cameraAccessError', 'Não foi possível aceder à câmara do dispositivo.'));
    }
  };

  const fecharCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((tr) => tr.stop());
      setCameraStream(null);
    }
    setCameraAberta(false);
    setFotoCapturada(null);
    setCameraErro(null);
  };

  useEffect(() => {
    if (cameraAberta && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((e) => console.log('Erro de visualização de vídeo:', e));
    }
  }, [cameraAberta, cameraStream]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((tr) => tr.stop());
      }
    };
  }, [cameraStream]);

  const alternarCamera = () => {
    const proximoModo = facingMode === 'environment' ? 'user' : 'environment';
    abrirCamera(proximoModo);
  };

  const tirarFoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setFotoCapturada(dataUrl);
  };

  const repetirFoto = () => {
    setFotoCapturada(null);
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((e) => console.log('Erro ao retomar vídeo:', e));
    }
  };

  // Processamento do Scan de Fatura com IA
  const handleUploadFile = async (file) => {
    if (!file) return;
    setScanning(true);
    setScanProgresso(t('facturasUi.scanStepOcr', 'A ler documento e a extrair texto com motor óptico...'));

    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      if (empresaId) formData.append('empresa_id', empresaId);

      setScanProgresso(
        t('facturasUi.scanStepAiAudit', 'A IA da AGT está a auditar o NIF, taxas de IVA, retenções e regras do CIVA...')
      );
      const res = await facturaService.scanFactura(formData);

      if (res.data?.success) {
        toast.success(`✨ ${res.data.mensagem || t('facturasUi.scanSuccess', 'Fatura processada com sucesso!')}`);
        if (res.data.factura) {
          setFacturaDetalhe(res.data.factura);
          // Se identificou empresa diferente, sugere seleção
          if (res.data.factura.empresa && String(res.data.factura.empresa) !== String(empresaId)) {
            atualizar({ empresaId: String(res.data.factura.empresa) });
          }
        }
        await carregarFacturas();
      }
    } catch (err) {
      console.error('Erro no scan da fatura:', err);
      const msg = err.response?.data?.error || err.message || t('facturasUi.scanError', 'Falha ao processar fatura com IA.');
      toast.error(`❌ ${msg}`);
    } finally {
      setScanning(false);
      setScanProgresso('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmarFotoEEnviar = async () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          toast.error(t('facturasUi.photoGenerateError', 'Erro ao gerar foto da factura.'));
          return;
        }
        const dataHora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const file = new File([blob], `factura_foto_${dataHora}.jpg`, { type: 'image/jpeg' });
        fecharCamera();
        await handleUploadFile(file);
      },
      'image/jpeg',
      0.92
    );
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
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  // Lançar no Diário de Compras
  const handleLancarNoDiario = async (factura) => {
    if (!factura || factura.lancado_na_contabilidade) return;
    setLancandoId(factura.id);
    try {
      const res = await facturaService.lancarNoDiario(factura.id);
      toast.success(`📘 ${res.data?.mensagem || t('facturasUi.postJournalSuccess', 'Fatura escriturada no Diário de Compras!')}`);
      if (facturaDetalhe && facturaDetalhe.id === factura.id) {
        setFacturaDetalhe(res.data?.factura || { ...facturaDetalhe, lancado_na_contabilidade: true });
      }
      await carregarFacturas();
    } catch (err) {
      console.error('Erro ao lançar fatura:', err);
      toast.error(err.response?.data?.error || t('facturasUi.postJournalError', 'Erro ao escriturar fatura.'));
    } finally {
      setLancandoId(null);
    }
  };

  // Excluir fatura
  const handleConfirmarExclusao = async () => {
    if (!facturaApagar) return;
    try {
      await facturaService.excluir(facturaApagar.id);
      toast.success(t('facturasUi.deleteSuccess', 'Fatura eliminada com sucesso.'));
      setFacturas((prev) => prev.filter((f) => f.id !== facturaApagar.id));
      if (facturaDetalhe?.id === facturaApagar.id) setFacturaDetalhe(null);
      setFacturaApagar(null);
      carregarFacturas();
    } catch (err) {
      toast.error(t('facturasUi.deleteError', 'Erro ao eliminar fatura.'));
    }
  };

  // Exportar Excel oficial Mapa de Fornecedores AGT
  const handleExportarExcel = async () => {
    setExportando(true);
    try {
      const params = {
        empresa_id: empresaId || undefined,
        ano: ano || undefined,
        mes: filtroMes !== 'todos' ? filtroMes : undefined,
      };
      const res = await facturaService.exportarExcel(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Mapa_Fornecedores_AGT_${empresaAtual?.nif || 'Geral'}_${ano || 'Periodo'}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(t('facturasUi.exportExcelSuccess', '📊 Mapa de Fornecedores da AGT exportado com sucesso em Excel!'));
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      toast.error(t('facturasUi.exportExcelError', 'Erro ao descarregar ficheiro Excel do mapa de fornecedores.'));
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="facturas-page py-10">
      {/* BANNER INFORMATIVO PARA OPERADOR DE FACTURAÇÃO */}
      {isOperador && (
        <div
          className="mb-25 p-16 d-flex flex-wrap align-items-center justify-content-between"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #bfdbfe',
            borderRadius: 14,
            gap: 16,
          }}
        >
          <div className="d-flex align-items-center" style={{ flex: '1 1 300px', gap: 14 }}>
            <span
              style={{
                width: 44,
                height: 44,
                minWidth: 44,
                flexShrink: 0,
                borderRadius: 12,
                background: '#2563eb',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                marginRight: 6,
              }}
            >
              <i className="la la-cloud-upload-alt"></i>
            </span>
            <div>
              <h6 className="fw-700 mb-2" style={{ color: '#0f172a', fontSize: 15 }}>
                {t('facturasUi.operatorBannerTitle', {
                  name: user.first_name || user.username || t('facturasUi.operatorDefaultName', 'Operador'),
                  defaultValue: 'Portal de Digitalização & Entrada de Facturas ({{name}})',
                })}
              </h6>
              <p className="mb-0" style={{ fontSize: 12.5, color: '#475569' }}>
                {t(
                  'facturasUi.operatorBannerDesc',
                  'Carregue os ficheiros em PDF ou imagens das facturas físicas recebidas. A inteligência artificial extrai todos os dados e certificação AGT. O lançamento no Diário de Compras do PGC será efetuado pela equipa de Contabilidade.'
                )}
              </p>
            </div>
          </div>
          <span
            className="badge py-6 px-12 font-weight-bold"
            style={{
              borderRadius: 20,
              fontSize: 11,
              backgroundColor: '#ffffff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              flexShrink: 0,
            }}
          >
            <i className="la la-user-check mr-4"></i> {t('facturasUi.operatorRoleBadge', 'Perfil: Operador de Facturação')}
          </span>
        </div>
      )}

      {/* 1. TOPO: TÍTULO & IDENTIFICAÇÃO DA EMPRESA */}
      <div
        className="d-flex flex-wrap justify-content-between align-items-center mb-25 pt-10"
        style={{ gap: 16, rowGap: 16 }}
      >
        <div style={{ flex: '1 1 360px', maxWidth: '100%' }}>
          <div className="d-flex align-items-center" style={{ gap: 14 }}>
            <span
              style={{
                width: 44,
                height: 44,
                minWidth: 44,
                flexShrink: 0,
                borderRadius: 12,
                background: '#2563eb',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                marginRight: 6,
              }}
            >
              <i className="la la-file-invoice-dollar"></i>
            </span>
            <div>
              <h4 className="fw-800 mb-2" style={{ fontSize: 21, color: '#0f172a' }}>
                {t('facturas.title', 'Leitor & Scanner de Facturas (IA)')}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13, lineHeight: 1.45 }}>
                {t('facturas.subtitle', 'Extração inteligente de dados do fornecedor, conformidade da AGT, apuramento de retenções e integração direta no Livro Diário do PGC.')}
              </p>
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center" style={{ gap: 10 }}>
          {!isOperador && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center"
              onClick={handleExportarExcel}
              disabled={exportando || facturas.length === 0}
              style={{ borderRadius: 8, height: 38, padding: '0 16px', fontWeight: 700 }}
            >
              <i className={`la ${exportando ? 'la-spinner la-spin' : 'la-file-excel'} mr-6`} style={{ fontSize: 16 }}></i>
              {exportando ? t('facturasUi.generatingMap', 'A Gerar Mapa...') : t('facturas.exportExcel', 'Exportar Mapa AGT (Excel)')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm d-inline-flex align-items-center"
            onClick={() => abrirCamera()}
            disabled={scanning}
            style={{ borderRadius: 8, height: 38, padding: '0 16px', fontWeight: 700 }}
            title={t('facturasUi.takePhotoTooltip', 'Tirar fotografia da factura física com a câmara ou webcam')}
          >
            <i className="la la-camera mr-6" style={{ fontSize: 16 }}></i>
            {t('facturas.takePhoto', 'Tirar Foto (Câmara)')}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm d-inline-flex align-items-center"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            style={{ borderRadius: 8, height: 38, padding: '0 16px', fontWeight: 700 }}
          >
            <i className={`la ${scanning ? 'la-spinner la-spin' : 'la-upload'} mr-6`} style={{ fontSize: 16 }}></i>
            {scanning ? t('facturasUi.analyzingBtn', 'A Analisar...') : t('facturasUi.uploadFileBtn', 'Carregar Ficheiro (PDF/Foto)')}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0])}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.heic,.txt,.xml"
            style={{ display: 'none' }}
          />
          <input
            type="file"
            ref={cameraInputFallbackRef}
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0])}
          />
        </div>
      </div>

      {/* 2. DROPZONE DE RECONHECIMENTO POR IA (ESTÉTICA UNIFICADA BRANCA + AZUL) */}
      <div
        className={`upload-drop-card mb-25 ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {scanning ? (
          <div className="py-20">
            <div className="spinner-border mb-15" role="status" style={{ width: '3rem', height: '3rem', color: '#2563eb' }}>
              <span className="sr-only">{t('facturasUi.analyzingSr', 'A analisar...')}</span>
            </div>
            <h5 className="fw-700 mb-6" style={{ color: '#2563eb' }}>
              {t('facturasUi.processingAiTitle', 'A Processar Documento Fiscal com IA...')}
            </h5>
            <p className="text-muted mb-0" style={{ fontSize: 13.5 }}>
              {scanProgresso}
            </p>
          </div>
        ) : (
          <div>
            <div className="upload-icon-circle">
              <i className="la la-cloud-upload-alt"></i>
            </div>
            <h5 className="fw-700 mb-6" style={{ color: '#0f172a' }}>
              {t('facturasUi.dropzoneTitle', 'Arraste a sua Factura para aqui (PDF ou Foto)')}
            </h5>
            <p className="text-muted mb-15" style={{ fontSize: 13, maxWidth: 620, margin: '0 auto' }}>
              {t(
                'facturasUi.dropzoneDesc',
                'A IA extrai automaticamente o NIF e dados do fornecedor, verifica a menção de certificação da AGT, calcula as retenções de IVA (7%) e Imposto Industrial (6.5%) e sugere a conta do PGC.'
              )}
            </p>
            <div
              className="d-flex flex-wrap justify-content-center align-items-center"
              style={{ gap: 12, marginTop: 16 }}
            >
              <button
                type="button"
                className="btn btn-primary btn-sm d-inline-flex align-items-center"
                onClick={() => abrirCamera()}
                style={{
                  borderRadius: 10,
                  height: 40,
                  padding: '0 20px',
                  fontWeight: 700,
                }}
              >
                <i className="la la-camera mr-8" style={{ fontSize: 17 }}></i>{' '}
                {t('facturasUi.takePhotoWithCamera', 'Tirar Foto com a Câmara')}
              </button>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm d-inline-flex align-items-center"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  borderRadius: 10,
                  height: 40,
                  padding: '0 20px',
                  fontWeight: 700,
                }}
              >
                <i className="la la-folder-open mr-8" style={{ fontSize: 17 }}></i>{' '}
                {t('facturasUi.selectFromComputer', 'Selecionar Ficheiro do Computador')}
              </button>
            </div>
            <div className="mt-14">
              <small className="text-muted" style={{ fontSize: 11.5 }}>
                {t(
                  'facturasUi.supportedFormats',
                  'Formatos suportados: Fotografias tiradas por câmara ou telemóvel, PDFs com selo AGT, imagens (PNG/JPG) e facturas eletrónicas.'
                )}
              </small>
            </div>
          </div>
        )}
      </div>

      {/* 3. CARDS DE MÉTRICAS & RESUMO DO MAPA FISCAL (FUNDO BRANCO PURO) */}
      {estatisticas && (
        <div className="row mb-25">
          <div className="col-xl-3 col-sm-6 mb-15">
            <div className="card" style={{ borderRadius: 12, border: '1px solid #e2e8f0', borderTop: '3px solid #2563eb', background: '#ffffff' }}>
              <div className="card-body p-18 d-flex align-items-center justify-content-between bg-white">
                <div>
                  <span className="text-muted fw-700" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                    {t('facturas.totalInvoices', 'TOTAL FACTURAS')}
                  </span>
                  <h4 className="fw-800 mb-0 mt-4" style={{ color: '#0f172a', fontSize: 22 }}>{estatisticas.total_contagem}</h4>
                  <small className="text-muted" style={{ fontSize: 11.5 }}>
                    {t('facturasUi.postedInJournalCount', {
                      count: estatisticas.lancadas,
                      defaultValue: '{{count}} escrituradas no diário',
                    })}
                  </small>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#ffffff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  <i className="la la-file-alt"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6 mb-15">
            <div className="card" style={{ borderRadius: 12, border: '1px solid #e2e8f0', borderTop: '3px solid #2563eb', background: '#ffffff' }}>
              <div className="card-body p-18 d-flex align-items-center justify-content-between bg-white">
                <div>
                  <span className="text-muted fw-700" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                    {t('facturas.baseAmount', 'BASE DE INCIDÊNCIA')}
                  </span>
                  <h4 className="fw-800 mb-0 mt-4" style={{ color: '#2563eb', fontSize: 20 }}>{formatarKz(estatisticas.total_base)}</h4>
                  <small className="text-muted" style={{ fontSize: 11.5 }}>
                    {t('facturasUi.netPurchasesTotal', 'Total líquido de compras')}
                  </small>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#ffffff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  <i className="la la-coins"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6 mb-15">
            <div className="card" style={{ borderRadius: 12, border: '1px solid #e2e8f0', borderTop: '3px solid #2563eb', background: '#ffffff' }}>
              <div className="card-body p-18 d-flex align-items-center justify-content-between bg-white">
                <div>
                  <span className="text-muted fw-700" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                    {t('facturas.vatSupported', 'IVA SUPORTADO / DEDUTÍVEL')}
                  </span>
                  <h4 className="fw-800 mb-0 mt-4" style={{ color: '#15803d', fontSize: 20 }}>{formatarKz(estatisticas.total_iva_dedutivel)}</h4>
                  <small className="text-muted" style={{ fontSize: 11.5 }}>
                    {t('facturasUi.supportedPrefix', 'Suportado')}: {formatarKz(estatisticas.total_iva_suportado)}
                  </small>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#ffffff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  <i className="la la-check-circle"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6 mb-15">
            <div className="card" style={{ borderRadius: 12, border: '1px solid #e2e8f0', borderTop: '3px solid #2563eb', background: '#ffffff' }}>
              <div className="card-body p-18 d-flex align-items-center justify-content-between bg-white">
                <div>
                  <span className="text-muted fw-700" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                    {t('facturasUi.withholdingTaxesTitle', 'RETENÇÕES NA FONTE')}
                  </span>
                  <h4 className="fw-800 mb-0 mt-4" style={{ color: '#0f172a', fontSize: 20 }}>
                    {formatarKz(estatisticas.total_retencao_iva + estatisticas.total_retencao_ii)}
                  </h4>
                  <small className="text-muted" style={{ fontSize: 11.5 }}>
                    {t('facturasUi.vat7Short', 'IVA 7%')}: {formatarKz(estatisticas.total_retencao_iva)} | {t('facturasUi.iiShort', 'II')}: {formatarKz(estatisticas.total_retencao_ii)}
                  </small>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#ffffff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                  }}
                >
                  <i className="la la-percentage"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. BARRA DE FILTROS & PESQUISA */}
      <div className="card mb-20" style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#ffffff' }}>
        <div className="card-body py-15 px-20 bg-white">
          <div className="row align-items-center">
            <div className="col-md-4 col-sm-12 mb-10 mb-md-0">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-right-0" style={{ border: '1px solid #cbd5e1' }}>
                  <i className="la la-search" style={{ color: '#2563eb' }}></i>
                </span>
                <input
                  type="text"
                  className="form-control border-left-0"
                  placeholder={t('facturas.searchPlaceholder', 'Pesquisar por fornecedor, NIF ou n.º fatura...')}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{ borderRadius: '0 8px 8px 0', height: 38 }}
                />
              </div>
            </div>

            <div className="col-md-3 col-sm-6 mb-10 mb-md-0">
              <select
                className="form-select form-select-sm"
                value={filtroMes}
                onChange={(e) => setFiltroMes(e.target.value)}
                style={{ height: 38, borderRadius: 8 }}
              >
                {MESES.map((m) => {
                  const nomeMes = m.valor === 'todos'
                    ? t('facturas.allMonths', 'Todos os Meses')
                    : t(`months.${['january','february','march','april','may','june','july','august','september','october','november','december'][parseInt(m.valor, 10) - 1]}`, m.nome);
                  return (
                    <option key={m.valor} value={m.valor}>
                      {nomeMes}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="col-md-3 col-sm-6 mb-10 mb-md-0">
              <select
                className="form-select form-select-sm"
                value={filtroConformidade}
                onChange={(e) => setFiltroConformidade(e.target.value)}
                style={{ height: 38, borderRadius: 8 }}
              >
                <option value="todos">{t('facturasUi.complianceAll', 'Todas as Conformidades AGT')}</option>
                <option value="CONFORME">{t('facturasUi.complianceCompliantOnly', 'Apenas Conformes AGT')}</option>
                <option value="AVISO">{t('facturasUi.complianceWarnings', 'Com Alertas / Avisos')}</option>
                <option value="IRREGULAR">{t('facturasUi.complianceIrregular', 'Irregulares')}</option>
              </select>
            </div>

            <div className="col-md-2 col-sm-12 text-md-end">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm w-100"
                onClick={carregarFacturas}
                style={{ height: 38, borderRadius: 8, fontWeight: 700 }}
              >
                <i className="la la-sync-alt mr-4"></i> {t('facturasUi.refreshBtn', 'Atualizar')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. TABELA DE FACTURAS */}
      <div className="card" style={{ borderRadius: 14, border: '1px solid #e2e8f0', background: '#ffffff' }}>
        <div className="card-header bg-white py-15 px-20 border-bottom d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 8 }}>
          <h6 className="fw-700 mb-0" style={{ color: '#0f172a' }}>
            <i className="la la-list-alt mr-6" style={{ color: '#2563eb' }}></i>{' '}
            {t('facturasUi.registeredInvoicesHeader', {
              count: facturas.length,
              defaultValue: 'Facturas Registadas & Auditadas ({{count}})',
            })}
          </h6>
          {empresaAtual && (
            <span
              className="badge"
              style={{
                fontSize: 11.5,
                background: '#ffffff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                padding: '5px 12px',
                borderRadius: 20,
                fontWeight: 700,
              }}
            >
              {t('facturasUi.activeCompanyBadge', {
                nome: empresaAtual.nome,
                nif: empresaAtual.nif,
                defaultValue: 'Empresa Ativa: {{nome}} (NIF: {{nif}})',
              })}
            </span>
          )}
        </div>

        <div className="card-body p-0 bg-white">
          {loading ? (
            <div className="text-center py-40">
              <div className="spinner-border" role="status" style={{ color: '#2563eb' }}>
                <span className="sr-only">{t('facturasUi.loadingSr', 'A carregar...')}</span>
              </div>
              <p className="text-muted mt-10 mb-0">{t('facturasUi.loadingInvoices', 'A carregar registo de facturas...')}</p>
            </div>
          ) : facturas.length === 0 ? (
            <div className="text-center py-50 px-20">
              <div className="upload-icon-circle">
                <i className="la la-file-invoice"></i>
              </div>
              <h6 className="fw-700 mt-10 mb-4" style={{ color: '#0f172a' }}>
                {t('facturasUi.emptyPeriodTitle', 'Nenhuma fatura encontrada neste período')}
              </h6>
              <p className="text-muted" style={{ fontSize: 12.5, maxWidth: 450, margin: '0 auto' }}>
                {t(
                  'facturasUi.emptyPeriodDesc',
                  'Arraste um PDF ou imagem de fatura para a área superior para processar automaticamente com a inteligência artificial.'
                )}
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: 12.5, background: '#ffffff' }}>
                <thead style={{ background: '#ffffff' }}>
                  <tr>
                    <th className="py-12 px-15">{t('facturas.invoiceNumber', 'Documento')}</th>
                    <th className="py-12 px-15">{t('facturas.issueDate', 'Data')}</th>
                    <th className="py-12 px-15">{t('facturas.supplier', 'Fornecedor / Emitente')}</th>
                    <th className="py-12 px-15 text-right">{t('facturas.baseAmount', 'Base Incidência')}</th>
                    <th className="py-12 px-15 text-right">{t('facturas.vatAmount', 'IVA (Taxa)')}</th>
                    <th className="py-12 px-15 text-right">{t('facturasUi.thWithholdings', 'Retenções')}</th>
                    <th className="py-12 px-15 text-right">{t('facturas.total', 'Total Líquido')}</th>
                    <th className="py-12 px-15 text-center">{t('facturasUi.thAgtCompliance', 'Conformidade AGT')}</th>
                    <th className="py-12 px-15 text-center">{t('facturasUi.thPgcJournal', 'Diário PGC')}</th>
                    <th className="py-12 px-15 text-center">{t('facturas.actions', 'Ações')}</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map((f) => {
                    const badgeConformidade = {
                      CONFORME: {
                        border: '#86efac',
                        text: '#15803d',
                        label: t('facturasUi.badgeCompliant', 'Conforme AGT'),
                        icon: 'la-check-circle',
                      },
                      AVISO: {
                        border: '#fcd34d',
                        text: '#b45309',
                        label: t('facturasUi.badgeWarning', 'Alerta Fiscal'),
                        icon: 'la-exclamation-triangle',
                      },
                      IRREGULAR: {
                        border: '#fca5a5',
                        text: '#dc2626',
                        label: t('facturasUi.badgeIrregular', 'Irregular'),
                        icon: 'la-times-circle',
                      },
                    }[f.conformidade_agt] || {
                      border: '#bfdbfe',
                      text: '#2563eb',
                      label: f.conformidade_agt,
                      icon: 'la-info-circle',
                    };

                    return (
                      <tr key={f.id}>
                        {/* Tipo e N.º da Fatura */}
                        <td className="px-15 py-12">
                          <div className="d-flex align-items-center" style={{ gap: 8 }}>
                            <span
                              className="badge font-weight-bold"
                              style={{
                                background: '#ffffff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe',
                                borderRadius: 4,
                              }}
                            >
                              {f.tipo_documento}
                            </span>
                            <span className="fw-700" style={{ color: '#0f172a' }}>{f.numero_factura}</span>
                          </div>
                          {f.hash_agt && (
                            <div className="text-muted" style={{ fontSize: 10.5 }}>
                              {t('facturasUi.agtHash', 'Hash AGT')}: <code>{f.hash_agt}</code>
                            </div>
                          )}
                        </td>

                        {/* Data Emissão */}
                        <td className="px-15 py-12">
                          <span className="text-nowrap">{f.data_emissao ? f.data_emissao.split('-').reverse().join('/') : '---'}</span>
                          {f.mes && f.ano && (
                            <div className="text-muted" style={{ fontSize: 10.5 }}>
                              {t('facturasUi.periodLabel', 'Período')}: {f.mes}/{f.ano}
                            </div>
                          )}
                        </td>

                        {/* Fornecedor & NIF */}
                        <td className="px-15 py-12" style={{ maxWidth: 240 }}>
                          <div className="fw-600 text-truncate" style={{ color: '#0f172a' }} title={f.fornecedor_nome}>
                            {f.fornecedor_nome || t('facturasUi.unidentified', 'Não identificado')}
                          </div>
                          <div className="text-muted" style={{ fontSize: 11 }}>
                            {t('facturasUi.nifLabel', 'NIF')}:{' '}
                            <span className="fw-600">{f.fornecedor_nif || t('facturasUi.noNif', 'Sem NIF')}</span>
                          </div>
                        </td>

                        {/* Base Incidência */}
                        <td className="px-15 py-12 text-right fw-700" style={{ color: '#0f172a' }}>{formatarKz(f.base_incidencia)}</td>

                        {/* IVA e Taxa */}
                        <td className="px-15 py-12 text-right">
                          <div className="fw-700" style={{ color: '#2563eb' }}>{formatarKz(f.valor_iva)}</div>
                          <small className="text-muted" style={{ fontSize: 10.5 }}>
                            {t('facturasUi.rateLabel', 'Taxa')}: {Number(f.taxa_iva)}%{' '}
                            {f.iva_dedutivel
                              ? t('facturasUi.deductibleParen', '(Dedutível)')
                              : t('facturasUi.nonDeductibleParen', '(Não dedutível)')}
                          </small>
                        </td>

                        {/* Retenções */}
                        <td className="px-15 py-12 text-right">
                          {Number(f.retencao_iva) > 0 || Number(f.retencao_ii) > 0 ? (
                            <div>
                              <span className="fw-700" style={{ color: '#0f172a' }}>
                                {formatarKz(Number(f.retencao_iva) + Number(f.retencao_ii))}
                              </span>
                              <div className="text-muted" style={{ fontSize: 10 }}>
                                {Number(f.retencao_iva) > 0 ? `${t('facturasUi.vat7Short', 'IVA 7%')}: ${formatarKz(f.retencao_iva)}` : ''}
                                {Number(f.retencao_ii) > 0 ? ` ${t('facturasUi.ii65Short', 'II 6.5%')}: ${formatarKz(f.retencao_ii)}` : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted">---</span>
                          )}
                        </td>

                        {/* Total Líquido */}
                        <td className="px-15 py-12 text-right">
                          <span className="fw-800" style={{ color: '#0f172a' }}>{formatarKz(f.valor_liquido || f.valor_total)}</span>
                        </td>

                        {/* Conformidade AGT */}
                        <td className="px-15 py-12 text-center">
                          <span
                            className="badge py-4 px-10 text-nowrap"
                            style={{
                              backgroundColor: '#ffffff',
                              color: badgeConformidade.text,
                              border: `1px solid ${badgeConformidade.border}`,
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            <i className={`la ${badgeConformidade.icon} mr-3`}></i>
                            {badgeConformidade.label}
                          </span>
                        </td>

                        {/* Estado no Diário PGC */}
                        <td className="px-15 py-12 text-center">
                          {f.lancado_na_contabilidade ? (
                            <span
                              className="badge py-4 px-10"
                              style={{
                                borderRadius: 12,
                                fontSize: 11,
                                fontWeight: 700,
                                background: '#ffffff',
                                color: '#15803d',
                                border: '1px solid #86efac',
                              }}
                            >
                              <i className="la la-check mr-3"></i>{' '}
                              {isOperador
                                ? t('facturasUi.postedOperator', 'Escriturado')
                                : `${t('facturasUi.postedAccountant', 'Lançado')}${f.lancamento_numero ? ` (${f.lancamento_numero})` : ''}`}
                            </span>
                          ) : isOperador ? (
                            <span
                              className="badge py-4 px-10 text-nowrap"
                              style={{
                                borderRadius: 12,
                                fontSize: 11,
                                backgroundColor: '#ffffff',
                                color: '#475569',
                                border: '1px solid #e2e8f0',
                              }}
                              title={t(
                                'facturasUi.awaitingAccountingTooltip',
                                'Aguardando validação e lançamento pela equipa de contabilidade'
                              )}
                            >
                              <i className="la la-clock mr-3" style={{ color: '#2563eb' }}></i>{' '}
                              {t('facturasUi.awaitingAccounting', 'Aguardando Contabilidade')}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-primary btn-xs py-4 px-10"
                              onClick={() => handleLancarNoDiario(f)}
                              disabled={lancandoId === f.id}
                              style={{ borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}
                              title={t(
                                'facturasUi.postToPurchasesTooltip',
                                'Criar lançamento automático no Livro Diário de Compras'
                              )}
                            >
                              <i className={`la ${lancandoId === f.id ? 'la-spinner la-spin' : 'la-book'} mr-3`}></i>
                              {lancandoId === f.id ? t('facturasUi.postingBtn', 'A Lançar...') : t('facturasUi.postBtn', 'Lançar')}
                            </button>
                          )}
                        </td>

                        {/* Ações (Botões Azuis Espaçados) */}
                        <td className="px-15 py-12 text-center text-nowrap">
                          <div className="d-inline-flex align-items-center" style={{ gap: 8 }}>
                            {f.documento_url && (
                              <a
                                href={formatarDocUrl(f.documento_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline-primary btn-xs"
                                title={
                                  f.is_imagem
                                    ? t('facturasUi.viewOriginalPhotoTooltip', 'Ver Foto Original da Factura')
                                    : t('facturasUi.viewOriginalPdfTooltip', 'Ver Documento Original (PDF)')
                                }
                                style={{ width: 32, height: 32, borderRadius: 6, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <i className={`la ${f.is_imagem ? 'la-camera' : 'la-file-pdf'}`} style={{ fontSize: 15 }}></i>
                              </a>
                            )}
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-xs"
                              onClick={() => setFacturaDetalhe(f)}
                              title={t('facturasUi.viewAiAnalysisTooltip', 'Ver análise completa da IA e dados fiscais')}
                              style={{ width: 32, height: 32, borderRadius: 6, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <i className="la la-eye" style={{ fontSize: 15 }}></i>
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-xs"
                              onClick={() => setFacturaApagar(f)}
                              title={t('facturasUi.deleteInvoiceTooltip', 'Eliminar fatura')}
                              style={{ width: 32, height: 32, borderRadius: 6, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <i className="la la-trash" style={{ fontSize: 15 }}></i>
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

      {/* 6. MODAL DE DETALHE & AUDITORIA DA FACTURA (IA) - FUNDO BRANCO PURO & BOTÕES AZUIS */}
      {facturaDetalhe && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10050,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setFacturaDetalhe(null);
          }}
        >
          <div
            className="modal-dialog"
            role="document"
            style={{
              width: '100%',
              maxWidth: 1060,
              maxHeight: 'calc(100vh - 24px)',
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              className="modal-content shadow-lg"
              style={{
                borderRadius: 14,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 24px)',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              {/* Cabeçalho do Modal */}
              <div
                className="modal-header py-14 px-20 border-bottom d-flex align-items-center justify-content-between"
                style={{ background: '#ffffff', flexShrink: 0 }}
              >
                <div className="d-flex align-items-center" style={{ gap: 12 }}>
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      minWidth: 40,
                      borderRadius: 10,
                      background: '#ffffff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                    }}
                  >
                    <i className="la la-file-invoice"></i>
                  </span>
                  <div>
                    <div className="d-flex flex-wrap align-items-center mb-2" style={{ gap: 6 }}>
                      <span
                        className="badge"
                        style={{
                          background: '#2563eb',
                          color: '#ffffff',
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        {facturaDetalhe.tipo_documento || 'FT'}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: '#ffffff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {facturaDetalhe.tipo_operacao === 'COMPRA'
                          ? t('facturasUi.opPurchaseSupplier', 'Compra / Fornecedor')
                          : t('facturasUi.opSaleCustomer', 'Venda / Cliente')}
                      </span>
                      {facturaDetalhe.regime_emissor && (
                        <span
                          className="badge"
                          style={{
                            background: '#ffffff',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {facturaDetalhe.regime_emissor}
                        </span>
                      )}
                      {facturaDetalhe.metadados?.via && (
                        <span
                          className="badge"
                          style={{
                            background: '#ffffff',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {t('facturasUi.copyLabel', 'Via')}: {facturaDetalhe.metadados.via}
                        </span>
                      )}
                    </div>
                    <h5 className="modal-title fw-800 mb-0" style={{ fontSize: 17, color: '#0f172a' }}>
                      {t('facturasUi.invoiceNumTitle', {
                        num: facturaDetalhe.numero_factura,
                        defaultValue: 'Factura N.º {{num}}',
                      })}
                    </h5>
                    <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                      {t('facturasUi.issueDateLabel', 'Data de Emissão')}:{' '}
                      <strong style={{ color: '#0f172a' }}>
                        {facturaDetalhe.data_emissao ? facturaDetalhe.data_emissao.split('-').reverse().join('/') : '---'}
                      </strong>
                      {facturaDetalhe.data_vencimento && (
                        <>
                          {' '}• {t('facturasUi.dueDateLabel', 'Vencimento')}:{' '}
                          <strong style={{ color: '#0f172a' }}>
                            {facturaDetalhe.data_vencimento.split('-').reverse().join('/')}
                          </strong>
                        </>
                      )}
                      {' • '}{t('facturasUi.fiscalPeriodLabel', 'Período Fiscal')}:{' '}
                      <strong style={{ color: '#0f172a' }}>{facturaDetalhe.mes}/{facturaDetalhe.ano}</strong>
                      {facturaDetalhe.criado_por_nome && (
                        <>
                          {' '}• {t('facturasUi.scannedByLabel', 'Digitalizado por')}:{' '}
                          <strong style={{ color: '#0f172a' }}>{facturaDetalhe.criado_por_nome}</strong>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center" style={{ gap: 10 }}>
                  {facturaDetalhe.documento_url && (
                    <a
                      href={formatarDocUrl(facturaDetalhe.documento_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-primary d-inline-flex align-items-center"
                      style={{ borderRadius: 8, fontSize: 12, padding: '6px 12px', gap: 6, fontWeight: 700 }}
                      title={t('facturasUi.openOriginalNewTabTooltip', 'Abrir ficheiro ou foto original em novo separador')}
                    >
                      <i className={`la ${facturaDetalhe.is_imagem ? 'la-camera' : 'la-file-pdf'}`}></i>
                      {facturaDetalhe.is_imagem
                        ? t('facturasUi.viewOriginalPhoto', 'Ver Foto Original')
                        : t('facturasUi.viewDocumentPdf', 'Ver Documento (PDF)')}
                      <i className="la la-external-link-alt" style={{ fontSize: 11 }}></i>
                    </a>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-xs"
                    onClick={() => setFacturaDetalhe(null)}
                    aria-label={t('common.close', 'Fechar')}
                    style={{ width: 34, height: 34, borderRadius: 8, fontSize: 18, lineHeight: 1, padding: 0 }}
                  >
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
              </div>

              {/* Corpo do Modal em Fundo Branco Puro */}
              <div className="modal-body p-20" style={{ background: '#ffffff', flex: '1 1 auto', overflowY: 'auto' }}>
                {/* 0. Pré-visualização ou Acesso ao Documento / Foto Original */}
                {facturaDetalhe.documento_url && (
                  facturaDetalhe.is_imagem ? (
                    <div className="card mb-18" style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div className="card-header py-8 px-14 bg-white border-bottom d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center" style={{ gap: 6 }}>
                          <i className="la la-camera" style={{ fontSize: 16, color: '#2563eb' }}></i>
                          <span className="fw-700" style={{ fontSize: 12.5, color: '#0f172a' }}>
                            {t('facturasUi.originalPhotoCaptured', {
                              name: facturaDetalhe.documento_nome || 'factura_foto.jpg',
                              defaultValue: 'Foto Original Capturada ({{name}})',
                            })}
                          </span>
                        </div>
                        <a
                          href={formatarDocUrl(facturaDetalhe.documento_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-xs btn-outline-primary d-inline-flex align-items-center"
                          style={{ borderRadius: 6, fontSize: 11, gap: 4 }}
                        >
                          <i className="la la-expand"></i> {t('facturasUi.openHighRes', 'Abrir em Alta Resolução')}
                        </a>
                      </div>
                      <div className="card-body p-12 text-center" style={{ background: '#ffffff' }}>
                        <img
                          src={formatarDocUrl(facturaDetalhe.documento_url)}
                          alt={t('facturasUi.originalPhotoAlt', 'Foto Original da Factura')}
                          style={{
                            maxHeight: 280,
                            maxWidth: '100%',
                            objectFit: 'contain',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="card mb-18" style={{ borderRadius: 10, border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div className="card-body py-10 px-15 d-flex flex-wrap align-items-center justify-content-between bg-white" style={{ gap: 10 }}>
                        <div className="d-flex align-items-center" style={{ gap: 10 }}>
                          <span
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: '#ffffff',
                              border: '1px solid #bfdbfe',
                              color: '#2563eb',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 20,
                            }}
                          >
                            <i className="la la-file-pdf"></i>
                          </span>
                          <div>
                            <div className="fw-700" style={{ fontSize: 13, color: '#0f172a' }}>
                              {facturaDetalhe.documento_nome || t('facturasUi.originalTaxDocPdf', 'Documento Fiscal Original (PDF)')}
                            </div>
                            <small className="text-muted" style={{ fontSize: 11 }}>
                              {t('facturasUi.originalSavedForAudit', 'Ficheiro original gravado e arquivado para auditoria da AGT')}
                            </small>
                          </div>
                        </div>
                        <a
                          href={formatarDocUrl(facturaDetalhe.documento_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center"
                          style={{ borderRadius: 8, fontSize: 12, gap: 6, fontWeight: 700 }}
                        >
                          <i className="la la-external-link-alt"></i> {t('facturasUi.viewDownloadPdf', 'Visualizar / Descarregar PDF')}
                        </a>
                      </div>
                    </div>
                  )
                )}

                {/* 1. Alertas e Notas de Conformidade */}
                {facturaDetalhe.alertas_auditoria && facturaDetalhe.alertas_auditoria.length > 0 && (
                  <div
                    className="mb-18 p-14"
                    style={{
                      background: '#ffffff',
                      border: '1px solid #fcd34d',
                      borderRadius: 10,
                    }}
                  >
                    <div className="d-flex align-items-center mb-6" style={{ gap: 6, color: '#b45309', fontWeight: 700, fontSize: 12.5 }}>
                      <i className="la la-shield-alt" style={{ fontSize: 16 }}></i>
                      <span>{t('facturasUi.complianceNotesTitle', 'Notas de Conformidade Fiscal & Validação AGT')}</span>
                    </div>
                    <div className="d-flex flex-column" style={{ gap: 4 }}>
                      {facturaDetalhe.alertas_auditoria.map((alerta, i) => (
                        <div key={i} className="d-flex align-items-start" style={{ gap: 6, fontSize: 12, color: '#475569' }}>
                          <span style={{ fontSize: 14, lineHeight: 1 }}>•</span>
                          <span>{alerta}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Fornecedor e Cliente */}
                <div className="row g-3 mb-18">
                  {/* FORNECEDOR / EMISSOR */}
                  <div className="col-md-6">
                    <div className="card h-100" style={{ borderRadius: 10, background: '#ffffff', border: '1px solid #e2e8f0' }}>
                      <div className="card-header py-8 px-14 border-bottom d-flex justify-content-between align-items-center" style={{ background: '#ffffff' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', color: '#2563eb' }}>
                          {t('facturasUi.issuerSupplierHeader', 'EMISSOR / FORNECEDOR')}
                        </span>
                        {facturaDetalhe.fornecedor_nif && (
                          <span style={{ background: '#ffffff', border: '1px solid #bfdbfe', color: '#0f172a', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                            {t('facturasUi.nifLabel', 'NIF')}: {facturaDetalhe.fornecedor_nif}
                          </span>
                        )}
                      </div>
                      <div className="card-body p-14 bg-white">
                        <h6 className="fw-700 mb-4" style={{ fontSize: 14, color: '#0f172a' }}>
                          {facturaDetalhe.fornecedor_nome || t('facturasUi.notSpecified', 'Não especificado')}
                        </h6>
                        {facturaDetalhe.fornecedor_endereco && (
                          <div className="text-muted mb-6 d-flex align-items-start" style={{ gap: 6, fontSize: 11.5, lineHeight: 1.4 }}>
                            <i className="la la-map-marker text-muted mt-2"></i>
                            <span>{facturaDetalhe.fornecedor_endereco}</span>
                          </div>
                        )}
                        <div className="row g-2 mt-4 pt-6 border-top" style={{ fontSize: 11.5, borderColor: '#e2e8f0' }}>
                          {facturaDetalhe.fornecedor_telefone && (
                            <div className="col-sm-6 text-muted">
                              <strong>{t('facturasUi.telLabel', 'Tel')}:</strong> {facturaDetalhe.fornecedor_telefone}
                            </div>
                          )}
                          {facturaDetalhe.fornecedor_email && (
                            <div className="col-sm-6 text-muted text-truncate" title={facturaDetalhe.fornecedor_email}>
                              <strong>{t('facturasUi.emailLabel', 'Email')}:</strong> {facturaDetalhe.fornecedor_email}
                            </div>
                          )}
                          {facturaDetalhe.fornecedor_website && (
                            <div className="col-12 text-muted text-truncate" title={facturaDetalhe.fornecedor_website}>
                              <strong>{t('facturasUi.siteLabel', 'Site')}:</strong> {facturaDetalhe.fornecedor_website}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CLIENTE / ADQUIRENTE */}
                  <div className="col-md-6">
                    <div className="card h-100" style={{ borderRadius: 10, background: '#ffffff', border: '1px solid #e2e8f0' }}>
                      <div className="card-header py-8 px-14 border-bottom d-flex justify-content-between align-items-center" style={{ background: '#ffffff' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.5px', color: '#2563eb' }}>
                          {t('facturasUi.customerAcquirerHeader', 'CLIENTE / ADQUIRENTE')}
                        </span>
                        {facturaDetalhe.cliente_nif && (
                          <span style={{ background: '#ffffff', border: '1px solid #bfdbfe', color: '#0f172a', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                            {t('facturasUi.nifLabel', 'NIF')}: {facturaDetalhe.cliente_nif}
                          </span>
                        )}
                      </div>
                      <div className="card-body p-14 bg-white">
                        <h6 className="fw-700 mb-4" style={{ fontSize: 14, color: '#0f172a' }}>
                          {facturaDetalhe.cliente_nome || t('facturasUi.notSpecified', 'Não especificado')}
                        </h6>
                        {facturaDetalhe.cliente_endereco && (
                          <div className="text-muted mb-6 d-flex align-items-start" style={{ gap: 6, fontSize: 11.5, lineHeight: 1.4 }}>
                            <i className="la la-map-marker text-muted mt-2"></i>
                            <span>{facturaDetalhe.cliente_endereco}</span>
                          </div>
                        )}
                        <div className="row g-2 mt-4 pt-6 border-top" style={{ fontSize: 11.5, borderColor: '#e2e8f0' }}>
                          {facturaDetalhe.cliente_telefone && (
                            <div className="col-sm-6 text-muted">
                              <strong>{t('facturasUi.telLabel', 'Tel')}:</strong> {facturaDetalhe.cliente_telefone}
                            </div>
                          )}
                          {facturaDetalhe.cliente_email && (
                            <div className="col-sm-6 text-muted text-truncate" title={facturaDetalhe.cliente_email}>
                              <strong>{t('facturasUi.emailLabel', 'Email')}:</strong> {facturaDetalhe.cliente_email}
                            </div>
                          )}
                        </div>
                        <div className="mt-8 pt-6 border-top" style={{ fontSize: 11, borderColor: '#e2e8f0' }}>
                          {empresaAtual && empresaAtual.nif === facturaDetalhe.cliente_nif ? (
                            <span style={{ color: '#15803d', fontWeight: 700 }}>
                              <i className="la la-check-circle mr-3"></i>{' '}
                              {t('facturasUi.nifMatchesActiveCompany', {
                                nome: empresaAtual.nome,
                                defaultValue: 'NIF coincide com a empresa ativa ({{nome}})',
                              })}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b' }}>
                              <i className="la la-info-circle mr-3"></i>{' '}
                              {t('facturasUi.nifDiffersActiveCompany', {
                                clienteNif: facturaDetalhe.cliente_nif || '---',
                                empresaNif: empresaAtual?.nif || '---',
                                defaultValue: 'NIF ({{clienteNif}}) difere da empresa ativa ({{empresaNif}})',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Linhas & Artigos da Factura */}
                <div className="card mb-18" style={{ borderRadius: 10, background: '#ffffff', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div className="card-header py-10 px-16 border-bottom d-flex justify-content-between align-items-center" style={{ background: '#ffffff' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.4px', color: '#0f172a' }}>
                      {t('facturasUi.invoiceItemsHeader', {
                        count: facturaDetalhe.itens_detalhe?.length || 0,
                        defaultValue: 'ARTIGOS & LINHAS DA FACTURA ({{count}})',
                      })}
                    </span>
                    <span style={{ fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
                      {t('facturasUi.fullAiExtractionBadge', 'Extração integral com IA')}
                    </span>
                  </div>
                  <div className="card-body p-0 bg-white">
                    {facturaDetalhe.itens_detalhe && facturaDetalhe.itens_detalhe.length > 0 ? (
                      <div className="table-responsive" style={{ maxHeight: 260, overflowY: 'auto' }}>
                        <table className="table table-hover align-middle mb-0" style={{ fontSize: 12, minWidth: 780, background: '#ffffff' }}>
                          <thead style={{ background: '#ffffff', position: 'sticky', top: 0, zIndex: 2 }}>
                            <tr style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                              <th className="py-8 px-12 text-center" style={{ width: 40 }}>#</th>
                              <th className="py-8 px-12" style={{ width: 110 }}>{t('facturasUi.itemThRef', 'Ref.')}</th>
                              <th className="py-8 px-12">{t('facturasUi.itemThDesc', 'Descrição do Bem / Serviço')}</th>
                              <th className="py-8 px-12 text-center" style={{ width: 65 }}>{t('facturasUi.itemThQty', 'Qtd')}</th>
                              <th className="py-8 px-12 text-center" style={{ width: 60 }}>{t('facturasUi.itemThUnit', 'Unid.')}</th>
                              <th className="py-8 px-12 text-end" style={{ width: 110 }}>{t('facturasUi.itemThUnitPrice', 'Preço Unit.')}</th>
                              <th className="py-8 px-12 text-end" style={{ width: 85 }}>{t('facturasUi.itemThDiscount', 'Desc.')}</th>
                              <th className="py-8 px-12 text-center" style={{ width: 95 }}>{t('facturasUi.itemThVatRate', 'Taxa IVA')}</th>
                              <th className="py-8 px-12 text-end" style={{ width: 100 }}>{t('facturasUi.itemThVatAmount', 'Valor IVA')}</th>
                              <th className="py-8 px-12 text-end" style={{ width: 120 }}>{t('facturasUi.itemThLineTotal', 'Total Linha')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {facturaDetalhe.itens_detalhe.map((item, idx) => {
                              const qtd = Number(item.quantidade) || 1;
                              const preco = Number(item.preco_unitario) || 0;
                              const desc = Number(item.desconto || item.desconto_valor || 0);
                              const taxa = Number(item.taxa_iva || 0);
                              const vIva = Number(item.valor_iva || 0);
                              const totalLinha = Number(item.total_liquido || item.total || (qtd * preco - desc + vIva));

                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td className="py-8 px-12 text-center text-muted fw-600">
                                    {item.numero_linha || idx + 1}
                                  </td>
                                  <td className="py-8 px-12">
                                    {item.codigo ? (
                                      <code style={{ background: '#ffffff', border: '1px solid #e2e8f0', color: '#334155', padding: '2px 5px', borderRadius: 4, fontSize: 11 }}>
                                        {item.codigo}
                                      </code>
                                    ) : (
                                      <span className="text-muted">---</span>
                                    )}
                                  </td>
                                  <td className="py-8 px-12">
                                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
                                      {item.descricao || t('facturasUi.itemNoDescription', 'Item sem descrição')}
                                    </div>
                                    {item.motivo_isencao && (
                                      <small className="text-muted d-block" style={{ fontSize: 10.5 }}>
                                        {item.motivo_isencao}
                                      </small>
                                    )}
                                  </td>
                                  <td className="py-8 px-12 text-center fw-600" style={{ color: '#0f172a' }}>{qtd.toLocaleString('pt-AO')}</td>
                                  <td className="py-8 px-12 text-center text-muted">{item.unidade || 'UNI'}</td>
                                  <td className="py-8 px-12 text-end fw-600" style={{ color: '#0f172a' }}>{formatarKz(preco)}</td>
                                  <td className="py-8 px-12 text-end text-muted">
                                    {desc > 0 ? `-${formatarKz(desc)}` : '0,00'}
                                  </td>
                                  <td className="py-8 px-12 text-center">
                                    <span
                                      style={{
                                        background: '#ffffff',
                                        color: '#2563eb',
                                        border: '1px solid #bfdbfe',
                                        borderRadius: 4,
                                        padding: '2px 6px',
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                      }}
                                    >
                                      {taxa === 0 ? t('facturasUi.zeroExempt', '0% (Isento)') : `${taxa}%`}
                                    </span>
                                  </td>
                                  <td className="py-8 px-12 text-end fw-600" style={{ color: '#0f172a' }}>
                                    {formatarKz(vIva)}
                                  </td>
                                  <td className="py-8 px-12 text-end fw-700" style={{ color: '#0f172a' }}>
                                    {formatarKz(totalLinha)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot style={{ background: '#ffffff', borderTop: '2px solid #e2e8f0' }}>
                            <tr>
                              <th colSpan="3" className="py-8 px-12 text-end fw-700" style={{ color: '#334155' }}>
                                {t('facturasUi.linesTotalLabel', 'Total das Linhas:')}
                              </th>
                              <th className="py-8 px-12 text-center fw-700" style={{ color: '#0f172a' }}>
                                {facturaDetalhe.itens_detalhe.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0)}
                              </th>
                              <th colSpan="5"></th>
                              <th className="py-8 px-12 text-end fw-800" style={{ color: '#0f172a' }}>
                                {formatarKz(
                                  facturaDetalhe.itens_detalhe.reduce(
                                    (acc, it) => acc + Number(it.total_liquido || it.total || (Number(it.quantidade || 1) * Number(it.preco_unitario || 0))),
                                    0
                                  )
                                )}
                              </th>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div className="p-16 text-center text-muted" style={{ fontSize: 12 }}>
                        {t('facturasUi.noIndividualItems', 'Nenhum item individual discriminado no documento original.')}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Totais Financeiros & IVA */}
                <div className="card mb-18" style={{ borderRadius: 10, background: '#ffffff', border: '1px solid #e2e8f0' }}>
                  <div className="card-header py-10 px-16 border-bottom" style={{ background: '#ffffff' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.4px', color: '#0f172a' }}>
                      {t('facturasUi.financialValuesHeader', 'VALORES FINANCEIROS & APURAMENTO DE IMPOSTOS')}
                    </span>
                  </div>
                  <div className="card-body p-16 bg-white">
                    <div className="row text-center mb-12 g-2">
                      <div className="col-sm-3 col-6 mb-8">
                        <span className="text-muted fw-600" style={{ fontSize: 11 }}>
                          {t('facturasUi.baseIncidenceCaps', 'BASE INCIDÊNCIA')}
                        </span>
                        <div className="fw-800 mt-2" style={{ fontSize: 16, color: '#0f172a' }}>
                          {formatarKz(facturaDetalhe.base_incidencia)}
                        </div>
                      </div>
                      <div className="col-sm-3 col-6 mb-8">
                        <span className="text-muted fw-600" style={{ fontSize: 11 }}>
                          {t('facturasUi.vatWithRateCaps', {
                            rate: Number(facturaDetalhe.taxa_iva),
                            defaultValue: 'IVA ({{rate}}%)',
                          })}
                        </span>
                        <div className="fw-800 mt-2" style={{ fontSize: 16, color: '#2563eb' }}>
                          {formatarKz(facturaDetalhe.valor_iva)}
                        </div>
                        <small className="text-muted" style={{ fontSize: 10.5 }}>
                          {facturaDetalhe.iva_dedutivel
                            ? t('facturasUi.deductible', 'Dedutível')
                            : t('facturasUi.excluded', 'Excluído')}
                        </small>
                      </div>
                      <div className="col-sm-3 col-6 mb-8">
                        <span className="text-muted fw-600" style={{ fontSize: 11 }}>
                          {t('facturasUi.withholdingsCaps', 'RETENÇÕES')}
                        </span>
                        <div className="fw-800 mt-2" style={{ fontSize: 16, color: '#0f172a' }}>
                          {formatarKz(Number(facturaDetalhe.retencao_iva || 0) + Number(facturaDetalhe.retencao_ii || 0))}
                        </div>
                      </div>
                      <div className="col-sm-3 col-6 mb-8">
                        <span className="text-muted fw-600" style={{ fontSize: 11 }}>
                          {t('facturasUi.grossTotalCaps', 'TOTAL BRUTO')}
                        </span>
                        <div className="fw-800 mt-2" style={{ fontSize: 16, color: '#0f172a' }}>
                          {formatarKz(facturaDetalhe.valor_total)}
                        </div>
                      </div>
                    </div>

                    <div className="p-14 rounded d-flex flex-wrap justify-content-between align-items-center" style={{ gap: 8, background: '#ffffff', border: '1px solid #bfdbfe' }}>
                      <div>
                        {facturaDetalhe.total_extenso ? (
                          <div className="text-muted font-italic" style={{ fontSize: 11.5 }}>
                            {facturaDetalhe.total_extenso}
                          </div>
                        ) : (
                          <div className="text-muted" style={{ fontSize: 11.5 }}>
                            {t('facturasUi.currencyLabel', 'Moeda')}: <strong>{facturaDetalhe.moeda || 'Kz (AOA)'}</strong>
                          </div>
                        )}
                      </div>
                      <div className="text-sm-end">
                        <span className="text-muted fw-700 mr-8" style={{ fontSize: 12 }}>
                          {t('facturasUi.netTotalPayableCaps', 'TOTAL LÍQUIDO A PAGAR:')}
                        </span>
                        <span className="fw-800" style={{ fontSize: 20, color: '#2563eb', letterSpacing: '-0.3px' }}>
                          {formatarKz(facturaDetalhe.valor_liquido || facturaDetalhe.valor_total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Contabilização no PGC */}
                <div className="card" style={{ borderRadius: 10, background: '#ffffff', border: '1px solid #e2e8f0' }}>
                  <div className="card-header py-10 px-16 border-bottom" style={{ background: '#ffffff' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.4px', color: '#0f172a' }}>
                      {t('facturasUi.suggestedPgcHeader', 'ESCRITURAÇÃO SUGERIDA NO PGC (LIVRO DIÁRIO)')}
                    </span>
                  </div>
                  <div className="card-body p-14 bg-white">
                    <div className="d-flex flex-column" style={{ gap: 8, fontSize: 12.5 }}>
                      <div className="d-flex align-items-center" style={{ gap: 8 }}>
                        <span className="badge" style={{ background: '#2563eb', color: '#ffffff', borderRadius: 4, padding: '2px 7px', fontSize: 10.5, fontWeight: 700 }}>D</span>
                        <span>
                          {t('facturasUi.accountWord', 'Conta')} <strong>{facturaDetalhe.conta_custo_sugerida}</strong> ({facturaDetalhe.conta_custo_nome}):{' '}
                          <strong>{formatarKz(facturaDetalhe.base_incidencia)}</strong>
                        </span>
                      </div>
                      {facturaDetalhe.iva_dedutivel && Number(facturaDetalhe.valor_iva) > 0 && (
                        <div className="d-flex align-items-center" style={{ gap: 8 }}>
                          <span className="badge" style={{ background: '#2563eb', color: '#ffffff', borderRadius: 4, padding: '2px 7px', fontSize: 10.5, fontWeight: 700 }}>D</span>
                          <span>
                            {t('facturasUi.accountWord', 'Conta')} <strong>{facturaDetalhe.conta_iva_sugerida}</strong> ({facturaDetalhe.conta_iva_nome}):{' '}
                            <strong>{formatarKz(facturaDetalhe.valor_iva)}</strong>
                          </span>
                        </div>
                      )}
                      {Number(facturaDetalhe.retencao_iva) > 0 && (
                        <div className="d-flex align-items-center" style={{ gap: 8 }}>
                          <span className="badge" style={{ background: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 7px', fontSize: 10.5, fontWeight: 700 }}>C</span>
                          <span>
                            {t('facturasUi.accountWord', 'Conta')} <strong>34.2.2</strong> ({t('facturasUi.vatWithholding7Desc', 'Retenção na Fonte de IVA 7%')}):{' '}
                            <strong>{formatarKz(facturaDetalhe.retencao_iva)}</strong>
                          </span>
                        </div>
                      )}
                      {Number(facturaDetalhe.retencao_ii) > 0 && (
                        <div className="d-flex align-items-center" style={{ gap: 8 }}>
                          <span className="badge" style={{ background: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 7px', fontSize: 10.5, fontWeight: 700 }}>C</span>
                          <span>
                            {t('facturasUi.accountWord', 'Conta')} <strong>34.2.1</strong> ({t('facturasUi.iiWithholding65Desc', 'Retenção Imposto Industrial 6.5%')}):{' '}
                            <strong>{formatarKz(facturaDetalhe.retencao_ii)}</strong>
                          </span>
                        </div>
                      )}
                      <div className="d-flex align-items-center" style={{ gap: 8 }}>
                        <span className="badge" style={{ background: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 7px', fontSize: 10.5, fontWeight: 700 }}>C</span>
                        <span>
                          {t('facturasUi.accountWord', 'Conta')} <strong>{facturaDetalhe.conta_terceiro_sugerida}</strong> ({facturaDetalhe.conta_terceiro_nome}):{' '}
                          <strong>{formatarKz(facturaDetalhe.valor_liquido || facturaDetalhe.valor_total)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé Fixo com Botões Azuis Espaçados */}
              <div
                className="modal-footer py-12 px-20 border-top d-flex justify-content-between align-items-center flex-wrap"
                style={{ background: '#ffffff', flexShrink: 0, gap: 10 }}
              >
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => {
                    const toDelete = facturaDetalhe;
                    setFacturaDetalhe(null);
                    setFacturaApagar(toDelete);
                  }}
                  style={{
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12.5,
                    padding: '6px 14px',
                  }}
                >
                  <i className="la la-trash mr-4"></i> {t('facturasUi.deleteInvoiceBtn', 'Eliminar Fatura')}
                </button>

                <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setFacturaDetalhe(null)}
                    style={{
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 12.5,
                      padding: '6px 16px',
                    }}
                  >
                    {t('facturasUi.closeBtn', 'Fechar')}
                  </button>
                  {isOperador ? (
                    <span
                      className="d-flex align-items-center px-12 py-6 text-muted"
                      style={{ gap: 6, background: '#ffffff', borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
                    >
                      <i className="la la-info-circle" style={{ color: '#2563eb' }}></i>
                      {facturaDetalhe.lancado_na_contabilidade
                        ? t('facturasUi.docPostedInJournalInfo', 'Documento escriturado no Livro Diário')
                        : t('facturasUi.postingReservedToAccounting', 'Escrituração no Livro Diário reservada à Contabilidade')}
                    </span>
                  ) : (
                    !facturaDetalhe.lancado_na_contabilidade && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm d-flex align-items-center"
                        onClick={() => handleLancarNoDiario(facturaDetalhe)}
                        disabled={lancandoId === facturaDetalhe.id}
                        style={{
                          gap: 6,
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 12.5,
                          padding: '6px 16px',
                        }}
                      >
                        <i className={`la ${lancandoId === facturaDetalhe.id ? 'la-spinner la-spin' : 'la-check-double'}`}></i>
                        {lancandoId === facturaDetalhe.id
                          ? t('facturasUi.postingProgressBtn', 'A Escriturar...')
                          : t('facturasUi.postToPurchasesJournalBtn', 'Lançar no Diário de Compras')}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DE CONFIRMAÇÃO DE ELIMINAÇÃO */}
      <ConfirmModal
        show={Boolean(facturaApagar)}
        title={t('facturasUi.deleteModalTitle', 'Eliminar Registo de Factura')}
        confirmLabel={t('facturasUi.deleteModalConfirm', 'Sim, Eliminar')}
        confirmClass="btn-primary"
        onConfirm={handleConfirmarExclusao}
        onClose={() => setFacturaApagar(null)}
      >
        <p className="mb-0">
          {t('facturasUi.deleteModalMsgPart1', 'Tem a certeza que deseja eliminar a fatura')}{' '}
          <strong>{facturaApagar?.numero_factura}</strong>{' '}
          {t('facturasUi.deleteModalMsgPart2', 'do fornecedor')}{' '}
          <strong>{facturaApagar?.fornecedor_nome || t('facturasUi.unknownSupplier', 'desconhecido')}</strong>
          {t('facturasUi.deleteModalMsgPart3', '? Esta ação não pode ser revertida.')}
        </p>
      </ConfirmModal>

      {/* 8. MODAL DE CAPTURA DE FOTOGRAFIA (CÂMARA) - FUNDO BRANCO PURO & BOTÕES AZUIS */}
      {cameraAberta && (
        <div
          className="modal fade show"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 1060,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) fecharCamera();
          }}
        >
          <div
            className="modal-dialog"
            style={{
              width: '100%',
              maxWidth: 680,
              margin: 0,
            }}
          >
            <div
              className="modal-content shadow-lg"
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
              }}
            >
              {/* Cabeçalho */}
              <div
                className="py-14 px-20 border-bottom d-flex align-items-center justify-content-between"
                style={{ background: '#ffffff', borderColor: '#e2e8f0' }}
              >
                <div className="d-flex align-items-center" style={{ gap: 10 }}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: '#ffffff',
                      border: '1px solid #bfdbfe',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                    }}
                  >
                    <i className="la la-camera"></i>
                  </span>
                  <div>
                    <h5 className="modal-title fw-800 mb-0" style={{ fontSize: 16, color: '#0f172a' }}>
                      {t('facturasUi.cameraModalTitle', 'Tirar Fotografia da Factura')}
                    </h5>
                    <small className="text-muted" style={{ fontSize: 12 }}>
                      {t('facturasUi.cameraModalSubtitle', 'Enquadre a factura ou talão no visor para extração automática com IA')}
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-xs"
                  onClick={fecharCamera}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    fontSize: 18,
                    padding: 0,
                  }}
                >
                  &times;
                </button>
              </div>

              {/* Visor da Câmara / Foto Capturada */}
              <div className="p-16 text-center position-relative" style={{ background: '#ffffff', minHeight: 340 }}>
                {cameraErro ? (
                  <div className="py-40 px-20 text-center">
                    <div className="upload-icon-circle">
                      <i className="la la-camera"></i>
                    </div>
                    <h6 className="fw-700 mb-8" style={{ color: '#0f172a' }}>
                      {t('facturasUi.cameraStartErrorTitle', 'Não foi possível iniciar a câmara')}
                    </h6>
                    <p className="text-muted" style={{ fontSize: 13, maxWidth: 460, margin: '0 auto 20px' }}>
                      {cameraErro}.{' '}
                      {t(
                        'facturasUi.cameraPermissionHint',
                        'Verifique se concedeu permissão de câmara ao seu navegador ou use o botão abaixo para abrir diretamente a câmara do seu telemóvel/computador.'
                      )}
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm px-20"
                      onClick={() => {
                        fecharCamera();
                        cameraInputFallbackRef.current?.click();
                      }}
                      style={{ borderRadius: 8, fontWeight: 700 }}
                    >
                      <i className="la la-camera mr-6"></i>{' '}
                      {t('facturasUi.openDeviceCameraBtn', 'Abrir Câmara do Dispositivo / Ficheiro')}
                    </button>
                  </div>
                ) : fotoCapturada ? (
                  <div className="d-flex flex-column align-items-center">
                    <div
                      style={{
                        width: '100%',
                        maxHeight: 460,
                        overflow: 'hidden',
                        borderRadius: 12,
                        border: '2px solid #2563eb',
                        position: 'relative',
                        background: '#ffffff',
                      }}
                    >
                      <img
                        src={fotoCapturada}
                        alt={t('facturasUi.capturedPhotoAlt', 'Foto capturada')}
                        style={{ width: '100%', maxHeight: 460, objectFit: 'contain' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: 10,
                          left: 10,
                          background: '#2563eb',
                          color: '#ffffff',
                          borderRadius: 6,
                          padding: '4px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <i className="la la-check-circle"></i>{' '}
                        {t('facturasUi.photoCapturedSuccessBadge', 'Foto Capturada com Sucesso')}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="position-relative d-inline-block w-100" style={{ maxHeight: 460 }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        maxHeight: 460,
                        objectFit: 'cover',
                        borderRadius: 12,
                        background: '#0f172a',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '8%',
                        left: '6%',
                        right: '6%',
                        bottom: '8%',
                        border: '2px dashed rgba(255, 255, 255, 0.7)',
                        borderRadius: 12,
                        pointerEvents: 'none',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 12,
                          left: 0,
                          right: 0,
                          textAlign: 'center',
                          color: '#ffffff',
                          fontSize: 12,
                          fontWeight: 600,
                          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                        }}
                      >
                        {t('facturasUi.cameraFrameGuide', 'Enquadre os dados da factura (NIF, artigos e totais) aqui')}
                      </div>
                    </div>
                  </div>
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>

              {/* Barra de Ações Inferior (Fundo Branco + Botões Azuis Espaçados) */}
              <div
                className="py-14 px-20 border-top d-flex align-items-center justify-content-between flex-wrap"
                style={{ borderColor: '#e2e8f0', background: '#ffffff', gap: 10 }}
              >
                {!fotoCapturada ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={fecharCamera}
                      style={{
                        borderRadius: 8,
                        padding: '7px 16px',
                        fontWeight: 700,
                      }}
                    >
                      {t('facturasUi.cancelBtn', 'Cancelar')}
                    </button>

                    <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm d-flex align-items-center"
                        onClick={alternarCamera}
                        title={t('facturasUi.switchCameraTooltip', 'Alternar entre câmara frontal e traseira')}
                        style={{
                          gap: 6,
                          borderRadius: 8,
                          padding: '7px 16px',
                          fontWeight: 700,
                        }}
                      >
                        <i className="la la-sync-alt"></i> {t('facturasUi.switchCameraBtn', 'Mudar Câmara')}
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm d-flex align-items-center px-20"
                        onClick={tirarFoto}
                        disabled={Boolean(cameraErro)}
                        style={{
                          gap: 8,
                          borderRadius: 10,
                          fontWeight: 700,
                          padding: '8px 22px',
                        }}
                      >
                        <i className="la la-camera"></i>
                        {t('facturasUi.takePhotoActionBtn', 'Tirar Fotografia')}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm d-flex align-items-center"
                      onClick={repetirFoto}
                      style={{
                        gap: 6,
                        borderRadius: 8,
                        padding: '7px 16px',
                        fontWeight: 700,
                      }}
                    >
                      <i className="la la-redo"></i> {t('facturasUi.retakePhotoBtn', 'Repetir Foto')}
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm d-flex align-items-center px-20"
                      onClick={confirmarFotoEEnviar}
                      style={{
                        gap: 8,
                        borderRadius: 10,
                        fontWeight: 700,
                        padding: '8px 22px',
                      }}
                    >
                      <i className="la la-magic" style={{ fontSize: 16 }}></i>{' '}
                      {t('facturasUi.processExtractAiBtn', 'Processar & Extrair Factura com IA')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Facturas;
