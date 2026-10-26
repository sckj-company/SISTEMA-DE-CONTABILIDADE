import React, { useState, useEffect, useCallback, useRef } from 'react';
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
      toast.error('Não foi possível carregar as facturas.');
    } finally {
      setLoading(false);
    }
  }, [empresaId, ano, filtroMes, filtroConformidade, busca]);

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
        cameraStream.getTracks().forEach((t) => t.stop());
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('O seu navegador não suporta captura direta por câmara. Use a opção de ficheiro ou câmara do dispositivo.');
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
      setCameraErro(err.message || 'Não foi possível aceder à câmara do dispositivo.');
    }
  };

  const fecharCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
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
        cameraStream.getTracks().forEach((t) => t.stop());
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
    setScanProgresso('A ler documento e a extrair texto com motor óptico...');

    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      if (empresaId) formData.append('empresa_id', empresaId);

      setScanProgresso('A IA da AGT está a auditar o NIF, taxas de IVA, retenções e regras do CIVA...');
      const res = await facturaService.scanFactura(formData);

      if (res.data?.success) {
        toast.success(`✨ ${res.data.mensagem || 'Fatura processada com sucesso!'}`);
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
      const msg = err.response?.data?.error || err.message || 'Falha ao processar fatura com IA.';
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
          toast.error('Erro ao gerar foto da factura.');
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
      toast.success(`📘 ${res.data?.mensagem || 'Fatura escriturada no Diário de Compras!'}`);
      if (facturaDetalhe && facturaDetalhe.id === factura.id) {
        setFacturaDetalhe(res.data?.factura || { ...facturaDetalhe, lancado_na_contabilidade: true });
      }
      await carregarFacturas();
    } catch (err) {
      console.error('Erro ao lançar fatura:', err);
      toast.error(err.response?.data?.error || 'Erro ao escriturar fatura.');
    } finally {
      setLancandoId(null);
    }
  };

  // Excluir fatura
  const handleConfirmarExclusao = async () => {
    if (!facturaApagar) return;
    try {
      await facturaService.excluir(facturaApagar.id);
      toast.success('Fatura eliminada com sucesso.');
      setFacturas((prev) => prev.filter((f) => f.id !== facturaApagar.id));
      if (facturaDetalhe?.id === facturaApagar.id) setFacturaDetalhe(null);
      setFacturaApagar(null);
      carregarFacturas();
    } catch (err) {
      toast.error('Erro ao eliminar fatura.');
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
      toast.success('📊 Mapa de Fornecedores da AGT exportado com sucesso em Excel!');
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      toast.error('Erro ao descarregar ficheiro Excel do mapa de fornecedores.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="facturas-page py-10">
      {/* BANNER INFORMATIVO PARA OPERADOR DE FACTURAÇÃO */}
      {isOperador && (
        <div
          className="alert mb-25 p-16 d-flex flex-wrap align-items-center justify-content-between"
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 14,
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)',
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
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.25)',
                marginRight: 6,
              }}
            >
              <i className="la la-cloud-upload-alt"></i>
            </span>
            <div>
              <h6 className="fw-700 mb-2" style={{ color: '#064e3b', fontSize: 15 }}>
                Portal de Digitalização & Entrada de Facturas ({user.first_name || user.username || 'Operador'})
              </h6>
              <p className="mb-0" style={{ fontSize: 12.5, color: '#047857' }}>
                Carregue os ficheiros em PDF ou imagens das facturas físicas recebidas. A inteligência artificial extrai todos os dados e certificação AGT. O lançamento no Diário de Compras do PGC será efetuado pela equipa de Contabilidade.
              </p>
            </div>
          </div>
          <span
            className="badge py-6 px-12 font-weight-bold"
            style={{
              borderRadius: 20,
              fontSize: 11,
              backgroundColor: '#d1fae5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              flexShrink: 0,
            }}
          >
            <i className="la la-user-check mr-4"></i> Perfil: Operador de Facturação
          </span>
        </div>
      )}

      {/* 1. TOPO: TÍTULO & IDENTIFICAÇÃO DA EMPRESA */}
      <div
        className="d-flex flex-wrap justify-content-between align-items-center mb-25"
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
                background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                boxShadow: '0 4px 10px rgba(99, 102, 241, 0.3)',
                marginRight: 6,
              }}
            >
              <i className="la la-file-invoice-dollar"></i>
            </span>
            <div>
              <h4 className="fw-700 color-dark mb-2" style={{ fontSize: 19 }}>
                Leitor & Scanner de Facturas (IA)
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13, lineHeight: 1.45 }}>
                Extração inteligente de dados do fornecedor, conformidade da AGT, apuramento de retenções e integração direta no Livro Diário do PGC.
              </p>
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center" style={{ gap: 12 }}>
          {!isOperador && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center"
              onClick={handleExportarExcel}
              disabled={exportando || facturas.length === 0}
              style={{ borderRadius: 8, height: 38, padding: '0 16px', margin: '3px 4px' }}
            >
              <i className={`la ${exportando ? 'la-spinner la-spin' : 'la-file-excel'} mr-6`} style={{ fontSize: 16 }}></i>
              {exportando ? 'A Gerar Mapa...' : 'Exportar Mapa AGT (Excel)'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm d-inline-flex align-items-center"
            onClick={() => abrirCamera()}
            disabled={scanning}
            style={{ borderRadius: 8, height: 38, padding: '0 16px', margin: '3px 4px' }}
            title="Tirar fotografia da factura física com a câmara ou webcam"
          >
            <i className="la la-camera mr-6" style={{ fontSize: 16 }}></i>
            Tirar Foto (Câmara)
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm d-inline-flex align-items-center"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            style={{ borderRadius: 8, height: 38, padding: '0 16px', margin: '3px 4px' }}
          >
            <i className={`la ${scanning ? 'la-spinner la-spin' : 'la-upload'} mr-6`} style={{ fontSize: 16 }}></i>
            {scanning ? 'A Analisar...' : 'Carregar Ficheiro (PDF/Foto)'}
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

      {/* 2. DROPZONE DE RECONHECIMENTO POR IA */}
      <div
        className={`card mb-25 ${isDragging ? 'border-primary' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: isDragging ? '2px dashed #4f46e5' : '1px dashed #cbd5e1',
          background: isDragging ? '#eef2ff' : '#f8fafc',
          borderRadius: 14,
          transition: 'all 0.2s ease',
        }}
      >
        <div className="card-body text-center py-30 px-20">
          {scanning ? (
            <div className="py-20">
              <div className="spinner-border text-primary mb-15" role="status" style={{ width: '3rem', height: '3rem' }}>
                <span className="sr-only">A analisar...</span>
              </div>
              <h5 className="fw-700 text-primary mb-6">A Processar Documento Fiscal com IA...</h5>
              <p className="text-muted mb-0" style={{ fontSize: 13.5 }}>
                {scanProgresso}
              </p>
            </div>
          ) : (
            <div>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#e0e7ff',
                  color: '#4f46e5',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  marginBottom: 12,
                }}
              >
                <i className="la la-cloud-upload-alt"></i>
              </div>
              <h5 className="fw-700 mb-6">Arraste a sua Factura para aqui (PDF ou Foto)</h5>
              <p className="text-muted mb-15" style={{ fontSize: 13, maxWidth: 620, margin: '0 auto' }}>
                A IA extrai automaticamente o NIF e dados do fornecedor, verifica a menção de certificação da AGT, calcula as retenções de IVA (7%) e Imposto Industrial (6.5%) e sugere a conta do PGC.
              </p>
              <div
                className="d-flex flex-wrap justify-content-center align-items-center"
                style={{ gap: 16, marginTop: 15 }}
              >
                <button
                  type="button"
                  className="btn btn-primary btn-sm px-20 d-inline-flex align-items-center"
                  onClick={() => abrirCamera()}
                  style={{
                    borderRadius: 20,
                    background: '#0f172a',
                    borderColor: '#0f172a',
                    height: 40,
                    margin: '4px 8px',
                    padding: '0 20px',
                  }}
                >
                  <i className="la la-camera mr-8" style={{ fontSize: 17 }}></i> Tirar Foto com a Câmara
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm px-20 d-inline-flex align-items-center"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    borderRadius: 20,
                    height: 40,
                    margin: '4px 8px',
                    padding: '0 20px',
                  }}
                >
                  <i className="la la-folder-open mr-8" style={{ fontSize: 17 }}></i> Selecionar Ficheiro do Computador
                </button>
              </div>
              <div className="mt-14">
                <small className="text-muted" style={{ fontSize: 11.5 }}>
                  Formatos suportados: Fotografias tiradas por câmara ou telemóvel, PDFs com selo AGT, imagens (PNG/JPG) e facturas eletrónicas.
                </small>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. CARDS DE MÉTRICAS & RESUMO DO MAPA FISCAL */}
      {estatisticas && (
        <div className="row mb-25">
          <div className="col-xl-3 col-sm-6 mb-15">
            <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
              <div className="card-body p-15 d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-muted fw-600" style={{ fontSize: 11.5 }}>
                    TOTAL FACTURAS
                  </span>
                  <h4 className="fw-700 mb-0 mt-4 color-dark">{estatisticas.total_contagem}</h4>
                  <small className="text-muted" style={{ fontSize: 11 }}>
                    {estatisticas.lancadas} escrituradas no diário
                  </small>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#f1f5f9',
                    color: '#475569',
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
            <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
              <div className="card-body p-15 d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-muted fw-600" style={{ fontSize: 11.5 }}>
                    BASE DE INCIDÊNCIA
                  </span>
                  <h4 className="fw-700 mb-0 mt-4 text-primary">{formatarKz(estatisticas.total_base)}</h4>
                  <small className="text-muted" style={{ fontSize: 11 }}>
                    Total líquido de compras
                  </small>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#e0e7ff',
                    color: '#4338ca',
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
            <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
              <div className="card-body p-15 d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-muted fw-600" style={{ fontSize: 11.5 }}>
                    IVA SUPORTADO / DEDUTÍVEL
                  </span>
                  <h4 className="fw-700 mb-0 mt-4 text-success">{formatarKz(estatisticas.total_iva_dedutivel)}</h4>
                  <small className="text-muted" style={{ fontSize: 11 }}>
                    Suportado: {formatarKz(estatisticas.total_iva_suportado)}
                  </small>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#dcfce7',
                    color: '#15803d',
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
            <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
              <div className="card-body p-15 d-flex align-items-center justify-content-between">
                <div>
                  <span className="text-muted fw-600" style={{ fontSize: 11.5 }}>
                    RETENÇÕES NA FONTE
                  </span>
                  <h4 className="fw-700 mb-0 mt-4 text-warning">
                    {formatarKz(estatisticas.total_retencao_iva + estatisticas.total_retencao_ii)}
                  </h4>
                  <small className="text-muted" style={{ fontSize: 11 }}>
                    IVA 7%: {formatarKz(estatisticas.total_retencao_iva)} | II: {formatarKz(estatisticas.total_retencao_ii)}
                  </small>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: '#fef3c7',
                    color: '#b45309',
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
      <div className="card mb-20 border-0 shadow-sm" style={{ borderRadius: 12 }}>
        <div className="card-body py-15 px-20">
          <div className="row align-items-center">
            <div className="col-md-4 col-sm-12 mb-10 mb-md-0">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-right-0">
                  <i className="la la-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-left-0"
                  placeholder="Pesquisar por fornecedor, NIF ou n.º fatura..."
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
                {MESES.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3 col-sm-6 mb-10 mb-md-0">
              <select
                className="form-select form-select-sm"
                value={filtroConformidade}
                onChange={(e) => setFiltroConformidade(e.target.value)}
                style={{ height: 38, borderRadius: 8 }}
              >
                <option value="todos">Todas as Conformidades AGT</option>
                <option value="CONFORME">🟢 Apenas Conformes AGT</option>
                <option value="AVISO">🟡 Com Alertas / Avisos</option>
                <option value="IRREGULAR">🔴 Irregulares</option>
              </select>
            </div>

            <div className="col-md-2 col-sm-12 text-md-end">
              <button
                type="button"
                className="btn btn-light btn-sm w-100"
                onClick={carregarFacturas}
                style={{ height: 38, borderRadius: 8, fontWeight: 600 }}
              >
                <i className="la la-sync-alt mr-4"></i> Atualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. TABELA DE FACTURAS */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: 14 }}>
        <div className="card-header bg-white py-15 px-20 border-bottom d-flex justify-content-between align-items-center">
          <h6 className="fw-700 mb-0 color-dark">
            <i className="la la-list-alt text-primary mr-6"></i> Facturas Registadas & Auditadas ({facturas.length})
          </h6>
          {empresaAtual && (
            <span className="badge badge-round badge-light text-muted" style={{ fontSize: 11 }}>
              Empresa Ativa: {empresaAtual.nome} (NIF: {empresaAtual.nif})
            </span>
          )}
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-40">
              <div className="spinner-border text-primary" role="status">
                <span className="sr-only">A carregar...</span>
              </div>
              <p className="text-muted mt-10 mb-0">A carregar registo de facturas...</p>
            </div>
          ) : facturas.length === 0 ? (
            <div className="text-center py-50 px-20">
              <i className="la la-file-invoice text-muted" style={{ fontSize: 50 }}></i>
              <h6 className="fw-600 mt-15 mb-4 text-muted">Nenhuma fatura encontrada neste período</h6>
              <p className="text-muted" style={{ fontSize: 12.5, maxWidth: 450, margin: '0 auto' }}>
                Arraste um PDF ou imagem de fatura para a área superior para processar automaticamente com a inteligência artificial.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: 12.5 }}>
                <thead className="table-light">
                  <tr>
                    <th className="py-12 px-15">Documento</th>
                    <th className="py-12 px-15">Data</th>
                    <th className="py-12 px-15">Fornecedor / Emitente</th>
                    <th className="py-12 px-15 text-right">Base Incidência</th>
                    <th className="py-12 px-15 text-right">IVA (Taxa)</th>
                    <th className="py-12 px-15 text-right">Retenções</th>
                    <th className="py-12 px-15 text-right">Total Líquido</th>
                    <th className="py-12 px-15 text-center">Conformidade AGT</th>
                    <th className="py-12 px-15 text-center">Diário PGC</th>
                    <th className="py-12 px-15 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map((f) => {
                    const badgeConformidade = {
                      CONFORME: { bg: '#dcfce7', text: '#15803d', label: 'Conforme AGT', icon: 'la-check-circle' },
                      AVISO: { bg: '#fef3c7', text: '#b45309', label: 'Alerta Fiscal', icon: 'la-exclamation-triangle' },
                      IRREGULAR: { bg: '#fee2e2', text: '#b91c1c', label: 'Irregular', icon: 'la-times-circle' },
                    }[f.conformidade_agt] || { bg: '#f1f5f9', text: '#475569', label: f.conformidade_agt, icon: 'la-info-circle' };

                    return (
                      <tr key={f.id}>
                        {/* Tipo e N.º da Fatura */}
                        <td className="px-15 py-12">
                          <div className="d-flex align-items-center gap-8">
                            <span
                              className="badge badge-sm font-weight-bold"
                              style={{
                                background: f.tipo_operacao === 'COMPRA' ? '#e0e7ff' : '#dcfce7',
                                color: f.tipo_operacao === 'COMPRA' ? '#4338ca' : '#15803d',
                                borderRadius: 4,
                              }}
                            >
                              {f.tipo_documento}
                            </span>
                            <span className="fw-700 color-dark">{f.numero_factura}</span>
                          </div>
                          {f.hash_agt && (
                            <div className="text-muted" style={{ fontSize: 10.5 }}>
                              Hash AGT: <code>{f.hash_agt}</code>
                            </div>
                          )}
                        </td>

                        {/* Data Emissão */}
                        <td className="px-15 py-12">
                          <span className="text-nowrap">{f.data_emissao ? f.data_emissao.split('-').reverse().join('/') : '---'}</span>
                          {f.mes && f.ano && (
                            <div className="text-muted" style={{ fontSize: 10.5 }}>
                              Período: {f.mes}/{f.ano}
                            </div>
                          )}
                        </td>

                        {/* Fornecedor & NIF */}
                        <td className="px-15 py-12" style={{ maxWidth: 240 }}>
                          <div className="fw-600 text-truncate color-dark" title={f.fornecedor_nome}>
                            {f.fornecedor_nome || 'Não identificado'}
                          </div>
                          <div className="text-muted" style={{ fontSize: 11 }}>
                            NIF: <span className="fw-600">{f.fornecedor_nif || 'Sem NIF'}</span>
                          </div>
                        </td>

                        {/* Base Incidência */}
                        <td className="px-15 py-12 text-right fw-600">{formatarKz(f.base_incidencia)}</td>

                        {/* IVA e Taxa */}
                        <td className="px-15 py-12 text-right">
                          <div className="fw-600 text-primary">{formatarKz(f.valor_iva)}</div>
                          <small className="text-muted" style={{ fontSize: 10.5 }}>
                            Taxa: {Number(f.taxa_iva)}% {f.iva_dedutivel ? '(Dedutível)' : '(Não dedutível)'}
                          </small>
                        </td>

                        {/* Retenções */}
                        <td className="px-15 py-12 text-right">
                          {Number(f.retencao_iva) > 0 || Number(f.retencao_ii) > 0 ? (
                            <div>
                              <span className="fw-600 text-warning">
                                {formatarKz(Number(f.retencao_iva) + Number(f.retencao_ii))}
                              </span>
                              <div className="text-muted" style={{ fontSize: 10 }}>
                                {Number(f.retencao_iva) > 0 ? `IVA 7%: ${formatarKz(f.retencao_iva)}` : ''}
                                {Number(f.retencao_ii) > 0 ? ` II 6.5%: ${formatarKz(f.retencao_ii)}` : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted">---</span>
                          )}
                        </td>

                        {/* Total Líquido */}
                        <td className="px-15 py-12 text-right">
                          <span className="fw-700 color-dark">{formatarKz(f.valor_liquido || f.valor_total)}</span>
                        </td>

                        {/* Conformidade AGT */}
                        <td className="px-15 py-12 text-center">
                          <span
                            className="badge py-4 px-8 text-nowrap"
                            style={{
                              backgroundColor: badgeConformidade.bg,
                              color: badgeConformidade.text,
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            <i className={`la ${badgeConformidade.icon} mr-3`}></i>
                            {badgeConformidade.label}
                          </span>
                        </td>

                        {/* Estado no Diário PGC */}
                        <td className="px-15 py-12 text-center">
                          {f.lancado_na_contabilidade ? (
                            <span className="badge badge-success py-4 px-8" style={{ borderRadius: 12, fontSize: 11 }}>
                              <i className="la la-check mr-3"></i> {isOperador ? 'Escriturado' : `Lançado ${f.lancamento_numero ? `(${f.lancamento_numero})` : ''}`}
                            </span>
                          ) : isOperador ? (
                            <span
                              className="badge py-4 px-8 text-nowrap"
                              style={{
                                borderRadius: 12,
                                fontSize: 11,
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                border: '1px solid #e2e8f0',
                              }}
                              title="Aguardando validação e lançamento pela equipa de contabilidade"
                            >
                              <i className="la la-clock mr-3 text-warning"></i> Aguardando Contabilidade
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-xs py-2 px-8"
                              onClick={() => handleLancarNoDiario(f)}
                              disabled={lancandoId === f.id}
                              style={{ borderRadius: 12, fontSize: 11 }}
                              title="Criar lançamento automático no Livro Diário de Compras"
                            >
                              <i className={`la ${lancandoId === f.id ? 'la-spinner la-spin' : 'la-book'} mr-3`}></i>
                              {lancandoId === f.id ? 'A Lançar...' : 'Lançar'}
                            </button>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-15 py-12 text-center text-nowrap">
                          {f.documento_url && (
                            <a
                              href={formatarDocUrl(f.documento_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-icon btn-light btn-sm mr-6"
                              title={f.is_imagem ? "Ver Foto Original da Factura" : "Ver Documento Original (PDF)"}
                              style={{ width: 32, height: 32, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <i className={`la ${f.is_imagem ? 'la-camera text-info' : 'la-file-pdf text-danger'}`} style={{ fontSize: 16 }}></i>
                            </a>
                          )}
                          <button
                            type="button"
                            className="btn btn-icon btn-light btn-sm mr-6"
                            onClick={() => setFacturaDetalhe(f)}
                            title="Ver análise completa da IA e dados fiscais"
                            style={{ width: 32, height: 32, borderRadius: 6 }}
                          >
                            <i className="la la-eye text-primary"></i>
                          </button>
                          <button
                            type="button"
                            className="btn btn-icon btn-light btn-sm"
                            onClick={() => setFacturaApagar(f)}
                            title="Eliminar fatura"
                            style={{ width: 32, height: 32, borderRadius: 6 }}
                          >
                            <i className="la la-trash text-danger"></i>
                          </button>
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

      {/* 6. MODAL DE DETALHE & AUDITORIA DA FACTURA (IA) - EXTRAÇÃO COMPLETA SEM OMISSÕES */}
      {facturaDetalhe && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10050,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
              className="modal-content border-0 shadow-lg"
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
                <div className="d-flex align-items-center gap-12">
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      minWidth: 40,
                      borderRadius: 10,
                      background: '#f8fafc',
                      color: '#0f172a',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                    }}
                  >
                    <i className="la la-file-invoice"></i>
                  </span>
                  <div>
                    <div className="d-flex flex-wrap align-items-center gap-6 mb-2">
                      <span
                        className="badge"
                        style={{
                          background: '#0f172a',
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
                          background: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {facturaDetalhe.tipo_operacao === 'COMPRA' ? 'Compra / Fornecedor' : 'Venda / Cliente'}
                      </span>
                      {facturaDetalhe.regime_emissor && (
                        <span
                          className="badge"
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          {facturaDetalhe.regime_emissor}
                        </span>
                      )}
                      {facturaDetalhe.metadados?.via && (
                        <span
                          className="badge"
                          style={{
                            background: '#f8fafc',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          Via: {facturaDetalhe.metadados.via}
                        </span>
                      )}
                    </div>
                    <h5 className="modal-title fw-700 mb-0" style={{ fontSize: 17, color: '#0f172a' }}>
                      Factura N.º {facturaDetalhe.numero_factura}
                    </h5>
                    <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                      Data de Emissão: <strong style={{ color: '#0f172a' }}>{facturaDetalhe.data_emissao ? facturaDetalhe.data_emissao.split('-').reverse().join('/') : '---'}</strong>
                      {facturaDetalhe.data_vencimento && (
                        <> • Vencimento: <strong style={{ color: '#0f172a' }}>{facturaDetalhe.data_vencimento.split('-').reverse().join('/')}</strong></>
                      )}
                      {' • '}Período Fiscal: <strong style={{ color: '#0f172a' }}>{facturaDetalhe.mes}/{facturaDetalhe.ano}</strong>
                      {facturaDetalhe.criado_por_nome && (
                        <> • Digitalizado por: <strong style={{ color: '#0f172a' }}>{facturaDetalhe.criado_por_nome}</strong></>
                      )}
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-8">
                  {facturaDetalhe.documento_url && (
                    <a
                      href={formatarDocUrl(facturaDetalhe.documento_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-6"
                      style={{ borderRadius: 8, fontSize: 12, padding: '5px 12px', border: '1px solid #cbd5e1', color: '#1e293b' }}
                      title="Abrir ficheiro ou foto original em novo separador"
                    >
                      <i className={`la ${facturaDetalhe.is_imagem ? 'la-camera text-info' : 'la-file-pdf text-danger'}`}></i>
                      {facturaDetalhe.is_imagem ? 'Ver Foto Original' : 'Ver Documento (PDF)'}
                      <i className="la la-external-link-alt" style={{ fontSize: 11 }}></i>
                    </a>
                  )}
                  <button
                    type="button"
                    className="btn btn-icon btn-light btn-sm"
                    onClick={() => setFacturaDetalhe(null)}
                    aria-label="Close"
                    style={{ width: 32, height: 32, borderRadius: 8, fontSize: 18, lineHeight: 1, border: '1px solid #e2e8f0' }}
                  >
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
              </div>

              {/* Corpo do Modal com Scroll Interno Limpo */}
              <div className="modal-body p-20" style={{ background: '#f8fafc', flex: '1 1 auto', overflowY: 'auto' }}>
                {/* 0. Pré-visualização ou Acesso ao Documento / Foto Original */}
                {facturaDetalhe.documento_url && (
                  facturaDetalhe.is_imagem ? (
                    <div className="card border-0 shadow-sm mb-18" style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <div className="card-header py-8 px-14 bg-white border-bottom d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-6">
                          <i className="la la-camera text-info" style={{ fontSize: 16 }}></i>
                          <span className="fw-700 color-dark" style={{ fontSize: 12.5 }}>
                            Foto Original Capturada ({facturaDetalhe.documento_nome || 'factura_foto.jpg'})
                          </span>
                        </div>
                        <a
                          href={formatarDocUrl(facturaDetalhe.documento_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-xs btn-outline-primary d-inline-flex align-items-center gap-4"
                          style={{ borderRadius: 6, fontSize: 11 }}
                        >
                          <i className="la la-expand"></i> Abrir Imagem em Alta Resolução
                        </a>
                      </div>
                      <div className="card-body p-12 text-center" style={{ background: '#0f172a' }}>
                        <img
                          src={formatarDocUrl(facturaDetalhe.documento_url)}
                          alt="Foto Original da Factura"
                          style={{
                            maxHeight: 280,
                            maxWidth: '100%',
                            objectFit: 'contain',
                            borderRadius: 6,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="card border-0 shadow-sm mb-18" style={{ borderRadius: 10, border: '1px solid #e2e8f0', background: '#ffffff' }}>
                      <div className="card-body py-10 px-15 d-flex flex-wrap align-items-center justify-content-between gap-10">
                        <div className="d-flex align-items-center gap-10">
                          <span
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: '#fee2e2',
                              color: '#dc2626',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 20,
                            }}
                          >
                            <i className="la la-file-pdf"></i>
                          </span>
                          <div>
                            <div className="fw-700 color-dark" style={{ fontSize: 13 }}>
                              {facturaDetalhe.documento_nome || 'Documento Fiscal Original (PDF)'}
                            </div>
                            <small className="text-muted" style={{ fontSize: 11 }}>
                              Ficheiro original gravado e arquivado para auditoria da AGT
                            </small>
                          </div>
                        </div>
                        <a
                          href={formatarDocUrl(facturaDetalhe.documento_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-6"
                          style={{ borderRadius: 8, fontSize: 12 }}
                        >
                          <i className="la la-external-link-alt"></i> Visualizar / Descarregar PDF
                        </a>
                      </div>
                    </div>
                  )
                )}

                {/* 1. Alertas e Notas de Conformidade */}
                {facturaDetalhe.alertas_auditoria && facturaDetalhe.alertas_auditoria.length > 0 && (
                  <div
                    className="mb-18 p-12"
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fef3c7',
                      borderRadius: 10,
                    }}
                  >
                    <div className="d-flex align-items-center gap-6 mb-6" style={{ color: '#92400e', fontWeight: 700, fontSize: 12.5 }}>
                      <i className="la la-shield-alt" style={{ fontSize: 16 }}></i>
                      <span>Notas de Conformidade Fiscal & Validação AGT</span>
                    </div>
                    <div className="d-flex flex-column gap-4">
                      {facturaDetalhe.alertas_auditoria.map((alerta, i) => (
                        <div key={i} className="d-flex align-items-start gap-6" style={{ fontSize: 12, color: '#92400e' }}>
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
                    <div className="card h-100 border shadow-xs" style={{ borderRadius: 10, background: '#ffffff', borderColor: '#e2e8f0' }}>
                      <div className="card-header py-8 px-14 border-bottom d-flex justify-content-between align-items-center" style={{ background: '#f8fafc' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', color: '#475569' }}>
                          EMISSOR / FORNECEDOR
                        </span>
                        {facturaDetalhe.fornecedor_nif && (
                          <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                            NIF: {facturaDetalhe.fornecedor_nif}
                          </span>
                        )}
                      </div>
                      <div className="card-body p-14">
                        <h6 className="fw-700 mb-4" style={{ fontSize: 14, color: '#0f172a' }}>
                          {facturaDetalhe.fornecedor_nome || 'Não especificado'}
                        </h6>
                        {facturaDetalhe.fornecedor_endereco && (
                          <div className="text-muted mb-6 d-flex align-items-start gap-6" style={{ fontSize: 11.5, lineHeight: 1.4 }}>
                            <i className="la la-map-marker text-muted mt-2"></i>
                            <span>{facturaDetalhe.fornecedor_endereco}</span>
                          </div>
                        )}
                        <div className="row g-2 mt-4 pt-6 border-top" style={{ fontSize: 11.5, borderColor: '#f1f5f9' }}>
                          {facturaDetalhe.fornecedor_telefone && (
                            <div className="col-sm-6 text-muted">
                              <strong>Tel:</strong> {facturaDetalhe.fornecedor_telefone}
                            </div>
                          )}
                          {facturaDetalhe.fornecedor_email && (
                            <div className="col-sm-6 text-muted text-truncate" title={facturaDetalhe.fornecedor_email}>
                              <strong>Email:</strong> {facturaDetalhe.fornecedor_email}
                            </div>
                          )}
                          {facturaDetalhe.fornecedor_website && (
                            <div className="col-12 text-muted text-truncate" title={facturaDetalhe.fornecedor_website}>
                              <strong>Site:</strong> {facturaDetalhe.fornecedor_website}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CLIENTE / ADQUIRENTE */}
                  <div className="col-md-6">
                    <div className="card h-100 border shadow-xs" style={{ borderRadius: 10, background: '#ffffff', borderColor: '#e2e8f0' }}>
                      <div className="card-header py-8 px-14 border-bottom d-flex justify-content-between align-items-center" style={{ background: '#f8fafc' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', color: '#475569' }}>
                          CLIENTE / ADQUIRENTE
                        </span>
                        {facturaDetalhe.cliente_nif && (
                          <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                            NIF: {facturaDetalhe.cliente_nif}
                          </span>
                        )}
                      </div>
                      <div className="card-body p-14">
                        <h6 className="fw-700 mb-4" style={{ fontSize: 14, color: '#0f172a' }}>
                          {facturaDetalhe.cliente_nome || 'Não especificado'}
                        </h6>
                        {facturaDetalhe.cliente_endereco && (
                          <div className="text-muted mb-6 d-flex align-items-start gap-6" style={{ fontSize: 11.5, lineHeight: 1.4 }}>
                            <i className="la la-map-marker text-muted mt-2"></i>
                            <span>{facturaDetalhe.cliente_endereco}</span>
                          </div>
                        )}
                        <div className="row g-2 mt-4 pt-6 border-top" style={{ fontSize: 11.5, borderColor: '#f1f5f9' }}>
                          {facturaDetalhe.cliente_telefone && (
                            <div className="col-sm-6 text-muted">
                              <strong>Tel:</strong> {facturaDetalhe.cliente_telefone}
                            </div>
                          )}
                          {facturaDetalhe.cliente_email && (
                            <div className="col-sm-6 text-muted text-truncate" title={facturaDetalhe.cliente_email}>
                              <strong>Email:</strong> {facturaDetalhe.cliente_email}
                            </div>
                          )}
                        </div>
                        <div className="mt-8 pt-6 border-top" style={{ fontSize: 11, borderColor: '#f1f5f9' }}>
                          {empresaAtual && empresaAtual.nif === facturaDetalhe.cliente_nif ? (
                            <span style={{ color: '#166534', fontWeight: 600 }}>
                              <i className="la la-check-circle mr-3"></i> NIF coincide com a empresa ativa ({empresaAtual.nome})
                            </span>
                          ) : (
                            <span style={{ color: '#64748b' }}>
                              <i className="la la-info-circle mr-3"></i> NIF ({facturaDetalhe.cliente_nif || '---'}) difere da empresa ativa ({empresaAtual?.nif || '---'})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Linhas & Artigos da Factura */}
                <div className="card mb-18 border shadow-xs" style={{ borderRadius: 10, background: '#ffffff', borderColor: '#e2e8f0', overflow: 'hidden' }}>
                  <div className="card-header py-10 px-16 border-bottom d-flex justify-content-between align-items-center" style={{ background: '#f8fafc' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.4px', color: '#334155' }}>
                      ARTIGOS & LINHAS DA FACTURA ({facturaDetalhe.itens_detalhe?.length || 0})
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      Extração integral com IA
                    </span>
                  </div>
                  <div className="card-body p-0">
                    {facturaDetalhe.itens_detalhe && facturaDetalhe.itens_detalhe.length > 0 ? (
                      <div className="table-responsive" style={{ maxHeight: 260, overflowY: 'auto' }}>
                        <table className="table table-hover align-middle mb-0" style={{ fontSize: 12, minWidth: 780 }}>
                          <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>
                            <tr style={{ color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                              <th className="py-8 px-12 text-center" style={{ width: 40 }}>#</th>
                              <th className="py-8 px-12" style={{ width: 110 }}>Ref.</th>
                              <th className="py-8 px-12">Descrição do Bem / Serviço</th>
                              <th className="py-8 px-12 text-center" style={{ width: 65 }}>Qtd</th>
                              <th className="py-8 px-12 text-center" style={{ width: 60 }}>Unid.</th>
                              <th className="py-8 px-12 text-end" style={{ width: 110 }}>Preço Unit.</th>
                              <th className="py-8 px-12 text-end" style={{ width: 85 }}>Desc.</th>
                              <th className="py-8 px-12 text-center" style={{ width: 95 }}>Taxa IVA</th>
                              <th className="py-8 px-12 text-end" style={{ width: 100 }}>Valor IVA</th>
                              <th className="py-8 px-12 text-end" style={{ width: 120 }}>Total Linha</th>
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
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td className="py-8 px-12 text-center text-muted fw-600">
                                    {item.numero_linha || idx + 1}
                                  </td>
                                  <td className="py-8 px-12">
                                    {item.codigo ? (
                                      <code style={{ background: '#f1f5f9', color: '#334155', padding: '2px 5px', borderRadius: 4, fontSize: 11 }}>
                                        {item.codigo}
                                      </code>
                                    ) : (
                                      <span className="text-muted">---</span>
                                    )}
                                  </td>
                                  <td className="py-8 px-12">
                                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.descricao || 'Item sem descrição'}</div>
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
                                        background: '#f1f5f9',
                                        color: '#334155',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 4,
                                        padding: '2px 6px',
                                        fontSize: 10.5,
                                        fontWeight: 600,
                                      }}
                                    >
                                      {taxa === 0 ? '0% (Isento)' : `${taxa}%`}
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
                          <tfoot className="table-light border-top">
                            <tr>
                              <th colSpan="3" className="py-8 px-12 text-end fw-700" style={{ color: '#334155' }}>Total das Linhas:</th>
                              <th className="py-8 px-12 text-center fw-700" style={{ color: '#0f172a' }}>
                                {facturaDetalhe.itens_detalhe.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0)}
                              </th>
                              <th colSpan="5"></th>
                              <th className="py-8 px-12 text-end fw-700" style={{ color: '#0f172a' }}>
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
                        Nenhum item individual discriminado no documento original.
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Totais Financeiros & IVA */}
                <div className="card mb-18 border shadow-xs" style={{ borderRadius: 10, background: '#ffffff', borderColor: '#e2e8f0' }}>
                  <div className="card-header py-10 px-16 border-bottom" style={{ background: '#f8fafc' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.4px', color: '#334155' }}>
                      VALORES FINANCEIROS & APURAMENTO DE IMPOSTOS
                    </span>
                  </div>
                  <div className="card-body p-16">
                    <div className="row text-center mb-12 g-2">
                      <div className="col-sm-3 col-6 mb-8">
                        <span className="text-muted fw-600" style={{ fontSize: 11 }}>BASE INCIDÊNCIA</span>
                        <div className="fw-700 mt-2" style={{ fontSize: 14, color: '#0f172a' }}>
                          {formatarKz(facturaDetalhe.base_incidencia)}
                        </div>
                      </div>
                      <div className="col-sm-3 col-6 mb-8">
                        <span className="text-muted fw-600" style={{ fontSize: 11 }}>IVA ({Number(facturaDetalhe.taxa_iva)}%)</span>
                        <div className="fw-700 mt-2" style={{ fontSize: 14, color: '#0f172a' }}>
                          {formatarKz(facturaDetalhe.valor_iva)}
                        </div>
                        <small className="text-muted" style={{ fontSize: 10.5 }}>
                          {facturaDetalhe.iva_dedutivel ? 'Dedutível' : 'Excluído'}
                        </small>
                      </div>
                      <div className="col-sm-3 col-6 mb-8">
                        <span className="text-muted fw-600" style={{ fontSize: 11 }}>RETENÇÕES</span>
                        <div className="fw-700 mt-2" style={{ fontSize: 14, color: '#0f172a' }}>
                          {formatarKz(Number(facturaDetalhe.retencao_iva || 0) + Number(facturaDetalhe.retencao_ii || 0))}
                        </div>
                      </div>
                      <div className="col-sm-3 col-6 mb-8">
                        <span className="text-muted fw-600" style={{ fontSize: 11 }}>TOTAL BRUTO</span>
                        <div className="fw-700 mt-2" style={{ fontSize: 14, color: '#0f172a' }}>
                          {formatarKz(facturaDetalhe.valor_total)}
                        </div>
                      </div>
                    </div>

                    <div className="p-12 rounded d-flex flex-wrap justify-content-between align-items-center gap-8" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div>
                        {facturaDetalhe.total_extenso ? (
                          <div className="text-muted font-italic" style={{ fontSize: 11.5 }}>
                            {facturaDetalhe.total_extenso}
                          </div>
                        ) : (
                          <div className="text-muted" style={{ fontSize: 11.5 }}>
                            Moeda: <strong>{facturaDetalhe.moeda || 'Kz (AOA)'}</strong>
                          </div>
                        )}
                      </div>
                      <div className="text-sm-end">
                        <span className="text-muted fw-600 mr-8" style={{ fontSize: 12 }}>TOTAL LÍQUIDO A PAGAR:</span>
                        <span className="fw-800" style={{ fontSize: 18, color: '#0f172a', letterSpacing: '-0.3px' }}>
                          {formatarKz(facturaDetalhe.valor_liquido || facturaDetalhe.valor_total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Contabilização no PGC */}
                <div className="card border shadow-xs" style={{ borderRadius: 10, background: '#ffffff', borderColor: '#e2e8f0' }}>
                  <div className="card-header py-10 px-16 border-bottom" style={{ background: '#f8fafc' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.4px', color: '#334155' }}>
                      ESCRITURAÇÃO SUGERIDA NO PGC (LIVRO DIÁRIO)
                    </span>
                  </div>
                  <div className="card-body p-14">
                    <div className="d-flex flex-column gap-6" style={{ fontSize: 12 }}>
                      <div className="d-flex align-items-center gap-8">
                        <span className="badge" style={{ background: '#0f172a', color: '#ffffff', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>D</span>
                        <span>Conta <strong>{facturaDetalhe.conta_custo_sugerida}</strong> ({facturaDetalhe.conta_custo_nome}): {formatarKz(facturaDetalhe.base_incidencia)}</span>
                      </div>
                      {facturaDetalhe.iva_dedutivel && Number(facturaDetalhe.valor_iva) > 0 && (
                        <div className="d-flex align-items-center gap-8">
                          <span className="badge" style={{ background: '#0f172a', color: '#ffffff', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>D</span>
                          <span>Conta <strong>{facturaDetalhe.conta_iva_sugerida}</strong> ({facturaDetalhe.conta_iva_nome}): {formatarKz(facturaDetalhe.valor_iva)}</span>
                        </div>
                      )}
                      {Number(facturaDetalhe.retencao_iva) > 0 && (
                        <div className="d-flex align-items-center gap-8">
                          <span className="badge" style={{ background: '#64748b', color: '#ffffff', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>C</span>
                          <span>Conta <strong>34.2.2</strong> (Retenção na Fonte de IVA 7%): {formatarKz(facturaDetalhe.retencao_iva)}</span>
                        </div>
                      )}
                      {Number(facturaDetalhe.retencao_ii) > 0 && (
                        <div className="d-flex align-items-center gap-8">
                          <span className="badge" style={{ background: '#64748b', color: '#ffffff', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>C</span>
                          <span>Conta <strong>34.2.1</strong> (Retenção Imposto Industrial 6.5%): {formatarKz(facturaDetalhe.retencao_ii)}</span>
                        </div>
                      )}
                      <div className="d-flex align-items-center gap-8">
                        <span className="badge" style={{ background: '#64748b', color: '#ffffff', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700 }}>C</span>
                        <span>Conta <strong>{facturaDetalhe.conta_terceiro_sugerida}</strong> ({facturaDetalhe.conta_terceiro_nome}): {formatarKz(facturaDetalhe.valor_liquido || facturaDetalhe.valor_total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé Fixo */}
              <div
                className="modal-footer py-12 px-20 border-top d-flex justify-content-between align-items-center"
                style={{ background: '#ffffff', flexShrink: 0 }}
              >
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    const toDelete = facturaDetalhe;
                    setFacturaDetalhe(null);
                    setFacturaApagar(toDelete);
                  }}
                  style={{
                    borderRadius: 8,
                    background: '#ffffff',
                    border: '1px solid #fee2e2',
                    color: '#dc2626',
                    fontWeight: 600,
                    fontSize: 12.5,
                    padding: '6px 14px',
                  }}
                >
                  <i className="la la-trash mr-4"></i> Eliminar Fatura
                </button>

                <div className="d-flex align-items-center gap-8">
                  <button
                    type="button"
                    className="btn btn-light btn-sm"
                    onClick={() => setFacturaDetalhe(null)}
                    style={{
                      borderRadius: 8,
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      color: '#475569',
                      fontWeight: 500,
                      fontSize: 12.5,
                      padding: '6px 14px',
                    }}
                  >
                    Fechar
                  </button>
                  {isOperador ? (
                    <span
                      className="d-flex align-items-center gap-6 px-12 py-6 text-muted"
                      style={{ background: '#f8fafc', borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
                    >
                      <i className="la la-info-circle text-muted"></i>
                      {facturaDetalhe.lancado_na_contabilidade
                        ? 'Documento escriturado no Livro Diário'
                        : 'Escrituração no Livro Diário reservada à Contabilidade'}
                    </span>
                  ) : (
                    !facturaDetalhe.lancado_na_contabilidade && (
                      <button
                        type="button"
                        className="btn btn-sm d-flex align-items-center gap-6"
                        onClick={() => handleLancarNoDiario(facturaDetalhe)}
                        disabled={lancandoId === facturaDetalhe.id}
                        style={{
                          borderRadius: 8,
                          background: '#0f172a',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 600,
                          fontSize: 12.5,
                          padding: '6px 16px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        <i className={`la ${lancandoId === facturaDetalhe.id ? 'la-spinner la-spin' : 'la-check-double'}`}></i>
                        {lancandoId === facturaDetalhe.id ? 'A Escriturar...' : 'Lançar no Diário de Compras'}
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
        title="Eliminar Registo de Factura"
        confirmLabel="Sim, Eliminar"
        confirmClass="btn-danger"
        onConfirm={handleConfirmarExclusao}
        onClose={() => setFacturaApagar(null)}
      >
        <p className="mb-0">
          Tem a certeza que deseja eliminar a fatura{' '}
          <strong>{facturaApagar?.numero_factura}</strong> do fornecedor{' '}
          <strong>{facturaApagar?.fornecedor_nome || 'desconhecido'}</strong>? Esta ação não pode ser revertida.
        </p>
      </ConfirmModal>

      {/* 8. MODAL DE CAPTURA DE FOTOGRAFIA (CÂMARA) */}
      {cameraAberta && (
        <div
          className="modal fade show"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
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
              className="modal-content border-0 shadow-2xl"
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: '1px solid #334155',
              }}
            >
              {/* Cabeçalho */}
              <div
                className="py-14 px-20 border-bottom d-flex align-items-center justify-content-between"
                style={{ borderColor: '#1e293b' }}
              >
                <div className="d-flex align-items-center gap-10">
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'rgba(99, 102, 241, 0.2)',
                      color: '#818cf8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                    }}
                  >
                    <i className="la la-camera"></i>
                  </span>
                  <div>
                    <h5 className="modal-title fw-700 text-white mb-0" style={{ fontSize: 16 }}>
                      Tirar Fotografia da Factura
                    </h5>
                    <small style={{ color: '#94a3b8', fontSize: 12 }}>
                      Enquadre a factura ou talão no visor para extração automática com IA
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-icon btn-sm"
                  onClick={fecharCamera}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: '#1e293b',
                    color: '#94a3b8',
                    border: 'none',
                    fontSize: 18,
                  }}
                >
                  &times;
                </button>
              </div>

              {/* Visor da Câmara / Foto Capturada */}
              <div className="p-16 text-center position-relative" style={{ background: '#020617', minHeight: 380 }}>
                {cameraErro ? (
                  <div className="py-40 px-20 text-center">
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#f87171',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 26,
                        marginBottom: 12,
                      }}
                    >
                      <i className="la la-exclamation-triangle"></i>
                    </div>
                    <h6 className="text-white fw-700 mb-8">Não foi possível iniciar a câmara</h6>
                    <p style={{ color: '#94a3b8', fontSize: 13, maxWidth: 460, margin: '0 auto 20px' }}>
                      {cameraErro}. Verifique se concedeu permissão de câmara ao seu navegador ou use o botão abaixo para abrir diretamente a câmara do seu telemóvel/computador.
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm px-20"
                      onClick={() => {
                        fecharCamera();
                        cameraInputFallbackRef.current?.click();
                      }}
                      style={{ borderRadius: 8 }}
                    >
                      <i className="la la-camera mr-6"></i> Abrir Câmara do Dispositivo / Ficheiro
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
                        border: '2px solid #22c55e',
                        position: 'relative',
                      }}
                    >
                      <img
                        src={fotoCapturada}
                        alt="Foto capturada"
                        style={{ width: '100%', maxHeight: 460, objectFit: 'contain' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: 10,
                          left: 10,
                          background: 'rgba(21, 128, 61, 0.85)',
                          color: '#ffffff',
                          borderRadius: 6,
                          padding: '4px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <i className="la la-check-circle"></i> Foto Capturada com Sucesso
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
                        background: '#000000',
                      }}
                    />
                    {/* Linhas de Enquadramento Guia */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '8%',
                        left: '6%',
                        right: '6%',
                        bottom: '8%',
                        border: '2px dashed rgba(255, 255, 255, 0.45)',
                        borderRadius: 12,
                        pointerEvents: 'none',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.25)',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 12,
                          left: 0,
                          right: 0,
                          textAlign: 'center',
                          color: 'rgba(255, 255, 255, 0.9)',
                          fontSize: 12,
                          fontWeight: 500,
                          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                        }}
                      >
                        Enquadre os dados da factura (NIF, artigos e totais) aqui
                      </div>
                    </div>
                  </div>
                )}
                {/* Canvas oculto para captura */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>

              {/* Barra de Ações Inferior */}
              <div
                className="py-14 px-20 border-top d-flex align-items-center justify-content-between"
                style={{ borderColor: '#1e293b', background: '#0f172a' }}
              >
                {!fotoCapturada ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={fecharCamera}
                      style={{
                        background: 'transparent',
                        color: '#94a3b8',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '6px 14px',
                      }}
                    >
                      Cancelar
                    </button>

                    <div className="d-flex align-items-center gap-12">
                      <button
                        type="button"
                        className="btn btn-sm d-flex align-items-center gap-6"
                        onClick={alternarCamera}
                        title="Alternar entre câmara frontal e traseira"
                        style={{
                          background: '#1e293b',
                          color: '#e2e8f0',
                          border: '1px solid #334155',
                          borderRadius: 8,
                          padding: '6px 14px',
                        }}
                      >
                        <i className="la la-sync-alt"></i> Mudar Câmara
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm d-flex align-items-center gap-8 px-20"
                        onClick={tirarFoto}
                        disabled={Boolean(cameraErro)}
                        style={{
                          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                          border: 'none',
                          borderRadius: 24,
                          fontWeight: 600,
                          padding: '8px 24px',
                          boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
                        }}
                      >
                        <span
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            background: '#ffffff',
                            display: 'inline-block',
                          }}
                        ></span>
                        Tirar Fotografia
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm d-flex align-items-center gap-6"
                      onClick={repetirFoto}
                      style={{
                        background: '#1e293b',
                        color: '#cbd5e1',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        padding: '6px 16px',
                      }}
                    >
                      <i className="la la-redo"></i> Repetir Foto
                    </button>

                    <button
                      type="button"
                      className="btn btn-success btn-sm d-flex align-items-center gap-8 px-20"
                      onClick={confirmarFotoEEnviar}
                      style={{
                        background: '#16a34a',
                        borderColor: '#16a34a',
                        borderRadius: 8,
                        fontWeight: 600,
                        padding: '8px 22px',
                        boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                      }}
                    >
                      <i className="la la-magic" style={{ fontSize: 16 }}></i> Processar & Extrair Factura com IA
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
