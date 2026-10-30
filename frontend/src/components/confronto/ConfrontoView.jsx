import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { usePeriodo, usePeriodoDaUrl } from '../../context/PeriodoContext';
import { empresaService, analiseService, authHeaders, API_BASE } from '../../services/api';
import { parseAnaliseIA, parseValorKz, formatKz } from '../../utils/analiseIaParser';
import ConsolidacaoAnualView from './ConsolidacaoAnualView';

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

const ConfrontoView = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const idiomaSistema = (i18n?.language || 'pt').substring(0, 2);
  const { empresaId, ano, mes, atualizar } = usePeriodo();
  usePeriodoDaUrl();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = Boolean(currentUser.is_admin || currentUser.is_superuser || currentUser.is_staff);

  const [empresas, setEmpresas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [, setCarregandoDocs] = useState(false);

  // Estados dos 3 Passos
  const [ficheiroContab, setFicheiroContab] = useState(null);
  const [ficheiroAgt, setFicheiroAgt] = useState(null);
  const [docContabId, setDocContabId] = useState('');
  const [docAgtId, setDocAgtId] = useState('');
  const [origemContab, setOrigemContab] = useState('upload'); // 'upload' | 'arquivo'
  const [origemAgt, setOrigemAgt] = useState('upload'); // 'upload' | 'arquivo'

  // Refs de Input File
  const fileInputContabRef = useRef(null);
  const fileInputAgtRef = useRef(null);

  // Execução e Resultado
  const [executando, setExecutando] = useState(false);
  const [etapaTexto, setEtapaTexto] = useState('');
  const [resultadoRaw, setResultadoRaw] = useState(null);
  const [analiseId, setAnaliseId] = useState(null);
  const [exportandoExcel, setExportandoExcel] = useState(false);

  // Tradução do Relatório
  const [idiomaRelatorio, setIdiomaRelatorio] = useState('pt');
  const [traducoes, setTraducoes] = useState({});
  const [traduzindo, setTraduzindo] = useState(false);
  const [visualizacaoTexto, setVisualizacaoTexto] = useState(false);

  // Histórico & Abas
  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('confronto'); // 'confronto' | 'consolidacao' | 'historico'

  // Carregar Empresas
  const carregarEmpresas = useCallback(async () => {
    try {
      const res = await empresaService.getAll();
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
    } catch {
      setEmpresas([]);
      return [];
    }
  }, [empresaId, atualizar]);

  useEffect(() => {
    carregarEmpresas();
  }, [carregarEmpresas]);

  // Carregar Documentos
  const carregarDocumentos = useCallback(async () => {
    setCarregandoDocs(true);
    try {
      const response = await fetch(`${API_BASE}/documentos/listar/`, { headers: authHeaders() });
      if (response.ok) {
        const data = await response.json();
        setDocumentos(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Erro ao carregar documentos:', err);
    } finally {
      setCarregandoDocs(false);
    }
  }, []);

  // Carregar Histórico
  const carregarHistorico = useCallback(async () => {
    setCarregandoHistorico(true);
    try {
      const res = await analiseService.getHistorico();
      setHistorico(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setCarregandoHistorico(false);
    }
  }, []);

  useEffect(() => {
    carregarDocumentos();
    carregarHistorico();
  }, [carregarDocumentos, carregarHistorico]);

  // Filtrar documentos da empresa ativa
  const docsDaEmpresa = useMemo(() => {
    if (!empresaId) return documentos;
    return documentos.filter((d) => String(d.empresa) === String(empresaId));
  }, [documentos, empresaId]);

  // Balancetes e Documentos AGT arquivados
  const balancetesDisponiveis = useMemo(() => {
    return docsDaEmpresa.filter(
      (d) =>
        d.tipo === 'BALANCETE' ||
        (d.nome_arquivo || '').toLowerCase().includes('balancete') ||
        (d.nome_arquivo || '').toLowerCase().includes('diario')
    );
  }, [docsDaEmpresa]);

  const docsAgtDisponiveis = useMemo(() => {
    return docsDaEmpresa.filter(
      (d) =>
        d.tipo === 'MODELO7' ||
        d.tipo === 'IMPOSTO_INDUSTRIAL' ||
        d.tipo === 'DECLARACAO_IRT' ||
        (d.nome_arquivo || '').toLowerCase().includes('modelo') ||
        (d.nome_arquivo || '').toLowerCase().includes('agt') ||
        (d.nome_arquivo || '').toLowerCase().includes('liquidacao') ||
        (d.nome_arquivo || '').toLowerCase().includes('comprovativo')
    );
  }, [docsDaEmpresa]);

  const empresaAtual = empresas.find((e) => String(e.id) === String(empresaId));

  // Função auxiliar de upload de ficheiro novo
  const fazerUploadFicheiro = async (file, tipo, overrideEmpresaId = null) => {
    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('tipo', tipo);
    formData.append('substituir', 'true');
    const empIdEnvio = overrideEmpresaId || empresaId;
    if (empIdEnvio) formData.append('empresa_id', empIdEnvio);
    if (ano) formData.append('ano', ano);
    if (mes) formData.append('mes', mes);

    const response = await fetch(`${API_BASE}/documentos/upload/`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Erro ao carregar ${file.name}`);
    }

    const data = await response.json();
    if (data.documento?.empresa) {
      atualizar({ empresaId: String(data.documento.empresa) });
      carregarEmpresas();
    }
    return data.documento;
  };

  // EXECUÇÃO DO CONFRONTO AUTOMÁTICO (OS 3 PASSOS)
  const handleExecutarConfronto = async () => {
    // Validação dos ficheiros
    const temContab = ficheiroContab || docContabId;
    const temAgt = ficheiroAgt || docAgtId;

    if (!temContab) {
      toast.warning('Por favor carregue ou selecione o Balancete de Verificação (Passo 1).');
      return;
    }
    if (!temAgt) {
      toast.warning('Por favor carregue ou selecione a Declaração Modelo 7 da AGT (Passo 1).');
      return;
    }

    setExecutando(true);
    setResultadoRaw(null);

    try {
      let finalContabId = docContabId;
      let finalAgtId = docAgtId;
      let empResolvida = null;

      // 1. Upload da Declaração AGT primeiro (possui NIF oficial e dados fiscais da AGT)
      if (ficheiroAgt && origemAgt === 'upload') {
        setEtapaTexto('1/3: A carregar e extrair dados da Declaração Modelo 7 da AGT...');
        const docAgtUpload = await fazerUploadFicheiro(ficheiroAgt, 'MODELO7');
        finalAgtId = docAgtUpload?.id;
        if (docAgtUpload?.empresa) {
          empResolvida = String(docAgtUpload.empresa);
        }
        setDocAgtId(String(finalAgtId));
      }

      // 2. Upload do Balancete se for novo ficheiro (associando à empresa resolvida)
      if (ficheiroContab && origemContab === 'upload') {
        setEtapaTexto('2/3: A carregar e extrair dados do Balancete de Verificação (PGC)...');
        const docContabUpload = await fazerUploadFicheiro(ficheiroContab, 'BALANCETE', empResolvida);
        finalContabId = docContabUpload?.id;
        setDocContabId(String(finalContabId));
      }

      // 3. Execução do Confronto com IA
      setEtapaTexto('3/3: Inteligência Artificial a cruzar contas e apurar conformidades fiscais...');
      const langEnvio = idiomaSistema || 'pt';
      const res = await analiseService.analisarDocumentos(finalContabId, finalAgtId, langEnvio);

      if (res.data?.success) {
        const resultadoFinal = res.data.resultado;
        setResultadoRaw(resultadoFinal);
        setAnaliseId(res.data.analise_id);
        setIdiomaRelatorio(langEnvio);
        setTraducoes({ [langEnvio]: resultadoFinal });
        toast.success('Confronto realizado com sucesso! Veja o relatório abaixo.');
        carregarHistorico();
        carregarDocumentos();

        // Rola a página suavemente para o relatório
        setTimeout(() => {
          const el = document.getElementById('secao-relatorio-confronto');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      } else {
        toast.error(res.data?.error || 'Não foi possível concluir o confronto.');
      }
    } catch (err) {
      console.error('Erro ao confrontar:', err);
      const msg = err.response?.data?.error || err.message || 'Erro ao processar ficheiros e executar confronto.';
      toast.error(msg);
    } finally {
      setExecutando(false);
      setEtapaTexto('');
    }
  };

  const handleTraduzirRelatorio = async (novoIdioma) => {
    if (novoIdioma === idiomaRelatorio) return;
    if (traducoes[novoIdioma]) {
      setIdiomaRelatorio(novoIdioma);
      setResultadoRaw(traducoes[novoIdioma]);
      const label = novoIdioma === 'zh' ? 'Chinês (中文)' : novoIdioma === 'en' ? 'Inglês (English)' : 'Português';
      toast.success(`Relatório alterado para ${label}.`);
      return;
    }

    const textoBase = traducoes['pt'] || resultadoRaw;
    if (!textoBase) {
      toast.warning('Nenhum relatório disponível para traduzir.');
      return;
    }

    setTraduzindo(true);
    const nomeIdioma = novoIdioma === 'zh' ? 'Chinês (中文)' : novoIdioma === 'en' ? 'Inglês (English)' : 'Português';
    toast.info(`A traduzir relatório para ${nomeIdioma} com Inteligência Artificial...`);

    try {
      const res = await analiseService.traduzir(textoBase, novoIdioma, analiseId);
      if (res.data?.success && res.data.resultado) {
        const textoTraduzido = res.data.resultado;
        setTraducoes((prev) => ({
          ...prev,
          [novoIdioma]: textoTraduzido,
          ...(prev['pt'] ? {} : { pt: textoBase }),
        }));
        setIdiomaRelatorio(novoIdioma);
        setResultadoRaw(textoTraduzido);
        toast.success(`Relatório traduzido com sucesso para ${nomeIdioma}!`);
      } else {
        toast.error(res.data?.error || 'Não foi possível traduzir o relatório.');
      }
    } catch (err) {
      console.error('Erro ao traduzir:', err);
      toast.error(err.response?.data?.error || 'Erro ao comunicar com a IA para tradução.');
    } finally {
      setTraduzindo(false);
    }
  };

  const textoPtCanonico = traducoes['pt'] || resultadoRaw;
  const parsedData = useMemo(() => {
    if (!textoPtCanonico) return null;
    return parseAnaliseIA(textoPtCanonico);
  }, [textoPtCanonico]);

  const handleLimparNovoConfronto = () => {
    setResultadoRaw(null);
    setAnaliseId(null);
    setTraducoes({});
    setIdiomaRelatorio('pt');
    setVisualizacaoTexto(false);
    setFicheiroContab(null);
    setFicheiroAgt(null);
    setDocContabId('');
    setDocAgtId('');
    if (fileInputContabRef.current) fileInputContabRef.current.value = '';
    if (fileInputAgtRef.current) fileInputAgtRef.current.value = '';
    toast.info('Pronto para um novo confronto. Carregue os novos ficheiros.');
  };

  const handleCarregarAnaliseHistorico = (item) => {
    setResultadoRaw(item.resultado);
    setAnaliseId(item.id);
    setIdiomaRelatorio('pt');
    setTraducoes({ pt: item.resultado });
    if (item.documento_contabilidade?.id) {
      setDocContabId(String(item.documento_contabilidade.id));
    }
    if (item.documento_agt?.id) {
      setDocAgtId(String(item.documento_agt.id));
    }
    setAbaAtiva('confronto');
    toast.info(`Análise #${item.id} carregada.`);
    setTimeout(() => {
      const el = document.getElementById('secao-relatorio-confronto');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 200);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportarExcel = async () => {
    if (!resultadoRaw) {
      toast.warning('Nenhum resultado de confronto disponível para exportar.');
      return;
    }
    setExportandoExcel(true);
    try {
      const payload = {
        texto: resultadoRaw,
        empresa_nome: empresaAtual?.nome || 'Empresa Contribuinte',
        nif: empresaAtual?.nif || '---',
        periodo: `${String(mes).padStart(2, '0')}/${ano}`,
        doc_contab: ficheiroContab?.name || balancetesDisponiveis.find((d) => String(d.id) === String(docContabId))?.nome_arquivo || 'Balancete de Verificação',
        doc_agt: ficheiroAgt?.name || docsAgtDisponiveis.find((d) => String(d.id) === String(docAgtId))?.nome_arquivo || 'Declaração Modelo 7 da AGT',
      };
      const res = await analiseService.exportarExcel(analiseId, payload);
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Relatorio_Confronto_Fiscal_${empresaAtual?.nif || 'AGT'}_${ano}_${mes}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Relatório Excel (.xlsx) descarregado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      toast.error('Erro ao gerar a folha de cálculo Excel do confronto.');
    } finally {
      setExportandoExcel(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
  };

  const prontoParaConfrontar = (ficheiroContab || docContabId) && (ficheiroAgt || docAgtId);

  return (
    <>
      <style>
        {`
        .confronto-kpi-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
          padding: 20px 22px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .confronto-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(37, 99, 235, 0.06);
        }
        .confronto-big-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 24px 22px;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 18px;
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .confronto-big-card:hover {
          border-color: #bfdbfe;
          box-shadow: 0 8px 24px rgba(37, 99, 235, 0.07);
        }
        .confronto-subbox {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px 18px;
        }
        .status-badge-conforme {
          background-color: #ffffff;
          color: #15803d;
          border: 1px solid #86efac;
          padding: 5px 12px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 11.5px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .status-badge-divergencia {
          background-color: #ffffff;
          color: #dc2626;
          border: 1px solid #fca5a5;
          padding: 5px 12px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 11.5px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .print-only {
          display: none;
        }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .sidebar-wrapper, .header-top { display: none !important; }
          .main-content { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          body { font-size: 10.5pt !important; background: #ffffff !important; color: #000000 !important; }
          .card, .confronto-big-card, .confronto-kpi-card { border: 1px solid #cbd5e1 !important; box-shadow: none !important; page-break-inside: avoid; }
          @page { margin: 12mm; size: A4 portrait; }
        }
        `}
      </style>

      {/* CABEÇALHO DA PÁGINA COM NAVEGAÇÃO LIMPA */}
      <div className="row mb-20 no-print pt-10">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 16 }}>
            <div>
              <h4 className="fw-800 mb-4" style={{ fontSize: 22, color: '#0f172a' }}>
                <i className="la la-balance-scale mr-6" style={{ color: '#2563eb' }}></i>{' '}
                {t('confrontoUi.headerTitle', 'Confronto Contabilidade vs Portal AGT')}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13.5 }}>
                {t('confrontoUi.headerSubtitle', 'Cruzamento inteligente em 3 passos: carregue o Balancete e o Modelo 7 para apurar os números e saldos fiscais.')}
              </p>
            </div>

            {/* SELEÇÃO DE ABAS (BOTÕES AZUIS SEPARADOS, NUNCA COLADOS) */}
            <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
              <button
                type="button"
                className={`btn btn-sm ${abaAtiva === 'confronto' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setAbaAtiva('confronto')}
                style={{ fontWeight: 700, fontSize: 13, padding: '8px 16px' }}
              >
                <i className="la la-bolt mr-4"></i> {t('confrontoUi.tabAiAudit', '1. Confronto com IA')}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${abaAtiva === 'consolidacao' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setAbaAtiva('consolidacao')}
                style={{ fontWeight: 700, fontSize: 13, padding: '8px 16px' }}
              >
                <i className="la la-calendar-check mr-4"></i> {t('confrontoUi.tabAnnualConsolidation', '2. Consolidação Anual (12 Meses)')}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${abaAtiva === 'historico' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setAbaAtiva('historico')}
                style={{ fontWeight: 700, fontSize: 13, padding: '8px 16px' }}
              >
                <i className="la la-history mr-4"></i> {t('confrontoUi.tabHistory', '3. Histórico')} ({historico.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ROTEAMENTO DE ABAS */}
      {abaAtiva === 'consolidacao' ? (
        <ConsolidacaoAnualView
          empresaId={empresaId}
          anoPadrao={ano}
          empresaAtual={empresaAtual}
        />
      ) : abaAtiva === 'historico' ? (
        /* HISTÓRICO DE ANÁLISES */
        <div className="row">
          <div className="col-12">
            <div className="card card-default" style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#ffffff' }}>
              <div className="card-header py-14 px-20 bg-white border-bottom">
                <strong className="color-dark" style={{ fontSize: 14 }}>
                  <i className="la la-history mr-5" style={{ color: '#2563eb' }}></i> Relatórios de Confronto Realizados Anteriormente
                </strong>
              </div>
              <div className="card-body p-0 bg-white">
                {carregandoHistorico ? (
                  <div className="text-center py-40">
                    <SpinDots />
                    <p className="text-muted mt-10">A carregar histórico...</p>
                  </div>
                ) : historico.length === 0 ? (
                  <div className="text-center py-40">
                    <div className="upload-icon-circle">
                      <i className="la la-chart-bar"></i>
                    </div>
                    <h5 className="mt-10">Nenhum confronto gravado no histórico</h5>
                    <p className="text-muted">Execute o primeiro confronto para arquivar o relatório.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0" style={{ fontSize: 13, background: '#ffffff' }}>
                      <thead style={{ backgroundColor: '#ffffff' }}>
                        <tr>
                          <th>ID</th>
                          <th>Balancete (Contabilidade)</th>
                          <th>Declaração AGT</th>
                          <th>Estado</th>
                          <th>Data de Execução</th>
                          <th style={{ textAlign: 'right' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historico.map((item) => (
                          <tr key={item.id}>
                            <td style={{ verticalAlign: 'middle', fontWeight: 700 }}>#{item.id}</td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <i className="la la-book mr-1" style={{ color: '#2563eb' }}></i>
                              {item.documento_contabilidade?.nome_arquivo || 'Balancete'}
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <i className="la la-landmark mr-1" style={{ color: '#2563eb' }}></i>
                              {item.documento_agt?.nome_arquivo || 'Modelo 7'}
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <span className="status-badge-conforme">
                                {item.status}
                              </span>
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              {item.created_at ? new Date(item.created_at).toLocaleString('pt-PT') : '---'}
                            </td>
                            <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleCarregarAnaliseHistorico(item)}
                                style={{ fontWeight: 600 }}
                              >
                                <i className="la la-eye mr-1"></i> Abrir Relatório
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ABA PRINCIPAL: OS 3 PASSOS DO CONFRONTO */
        <>
          {/* GUIA VISUAL DOS 3 PASSOS */}
          <div className="row mb-25 no-print">
            <div className="col-12">
              <div className="card card-default" style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#ffffff' }}>
                <div className="card-body py-15 px-20 bg-white">
                  <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 14 }}>
                    <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
                      <div className={`step-pill ${!resultadoRaw ? 'active' : ''}`}>
                        <span>{t('confrontoUi.pillStep1', '1. Carregar Balancete & Modelo 7')}</span>
                      </div>
                      <span style={{ color: '#93c5fd', fontWeight: 700 }}>&rarr;</span>
                      <div className={`step-pill ${executando ? 'active' : ''}`}>
                        <span>{t('confrontoUi.pillStep2', '2. Confrontar com IA')}</span>
                      </div>
                      <span style={{ color: '#93c5fd', fontWeight: 700 }}>&rarr;</span>
                      <div className={`step-pill ${resultadoRaw ? 'active' : ''}`}>
                        <span>{t('confrontoUi.pillStep3', '3. Cards Numéricos, Excel & PDF')}</span>
                      </div>
                    </div>

                    {/* SELETOR DE EMPRESA ATIVA */}
                    <div className="d-flex align-items-center" style={{ gap: 10 }}>
                      <span className="text-muted fw-600" style={{ fontSize: 12 }}>EMPRESA:</span>
                      {isAdmin ? (
                        <>
                          <select
                            className="form-control form-control-sm"
                            value={empresaId}
                            onChange={(e) => atualizar({ empresaId: e.target.value })}
                            style={{ height: 36, fontSize: 12.5, fontWeight: 700, minWidth: 200 }}
                          >
                            {empresas.length === 0 ? (
                              <option value="">Sem empresas cadastradas (+)</option>
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
                            className="btn btn-xs btn-outline-primary d-flex align-items-center justify-content-center"
                            onClick={() => navigate('/admin-gestao?aba=empresas&novaEmpresa=1')}
                            style={{ height: 36, width: 36, borderRadius: 8, padding: 0 }}
                            title="Cadastrar Nova Empresa"
                          >
                            <i className="la la-plus" style={{ fontSize: 16 }}></i>
                          </button>
                        </>
                      ) : (
                        <div
                          className="px-12 py-6 bg-white rounded fw-700 color-dark text-truncate d-flex align-items-center"
                          style={{ height: 36, fontSize: 12.5, maxWidth: 300, border: '1px solid #bfdbfe' }}
                          title={empresas.find((e) => String(e.id) === String(empresaId))?.nome || 'Minha Empresa'}
                        >
                          <i className="la la-building mr-1" style={{ color: '#2563eb' }}></i>
                          <span className="text-truncate">
                            {empresas.find((e) => String(e.id) === String(empresaId))?.nome || 'Minha Empresa'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PASSO 1: CAIXAS DE CARREGAMENTO DOS 2 FICHEIROS (MESMA ESTÉTICA BRANCA + AZUL) */}
          <div className="row mb-25 no-print" style={{ rowGap: 20 }}>
            {/* CAIXA 1: BALANCETE DA CONTABILIDADE */}
            <div className="col-12 col-lg-6">
              <div className="card card-default h-100" style={{ border: '1px solid #e2e8f0', borderRadius: 14, background: '#ffffff' }}>
                <div className="card-header py-14 px-20 bg-white border-bottom">
                  <div className="d-flex justify-content-between align-items-center flex-wrap w-100" style={{ gap: 10 }}>
                    <strong className="color-dark" style={{ fontSize: 14 }}>
                      <i className="la la-book mr-5" style={{ color: '#2563eb' }}></i> 1. Balancete de Verificação (PGC)
                    </strong>
                    <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className={`btn btn-xs ${origemContab === 'upload' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setOrigemContab('upload')}
                        style={{ fontSize: 11.5, fontWeight: 600, padding: '5px 12px' }}
                      >
                        Carregar Ficheiro
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs ${origemContab === 'arquivo' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setOrigemContab('arquivo')}
                        style={{ fontSize: 11.5, fontWeight: 600, padding: '5px 12px' }}
                      >
                        Do Arquivo ({balancetesDisponiveis.length})
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card-body p-20 bg-white d-flex flex-column justify-content-center">
                  {origemContab === 'upload' ? (
                    <div>
                      <input
                        type="file"
                        ref={fileInputContabRef}
                        accept=".pdf,.xlsx,.csv"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files[0]) {
                            setFicheiroContab(e.target.files[0]);
                            setDocContabId('');
                            toast.info(`Balancete selecionado: ${e.target.files[0].name}`);
                          }
                        }}
                      />
                      <div
                        className={`upload-drop-card ${ficheiroContab ? 'has-file' : ''}`}
                        onClick={() => fileInputContabRef.current?.click()}
                      >
                        {ficheiroContab ? (
                          <div>
                            <div className="upload-icon-circle">
                              <i className="la la-check"></i>
                            </div>
                            <strong className="d-block text-dark" style={{ fontSize: 14.5 }}>
                              {ficheiroContab.name}
                            </strong>
                            <span
                              className="badge mt-6"
                              style={{ fontSize: 11.5, background: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '5px 12px' }}
                            >
                              {formatFileSize(ficheiroContab.size)} &nbsp;·&nbsp; Pronto para confrontar
                            </span>
                            <div className="mt-12">
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-xs"
                                style={{ padding: '5px 14px', fontSize: 12 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFicheiroContab(null);
                                  if (fileInputContabRef.current) fileInputContabRef.current.value = '';
                                }}
                              >
                                <i className="la la-sync mr-1"></i> Trocar Ficheiro
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="upload-icon-circle">
                              <i className="la la-cloud-upload-alt"></i>
                            </div>
                            <strong className="d-block color-dark" style={{ fontSize: 14.5 }}>
                              Clique aqui para selecionar o Balancete
                            </strong>
                            <span className="text-muted d-block mt-6" style={{ fontSize: 12.5 }}>
                              Suporta ficheiros em <strong>PDF</strong> ou folha de cálculo <strong>Excel (.xlsx)</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="fw-600 text-muted mb-6" style={{ fontSize: 12 }}>
                        SELECIONE O BALANCETE JÁ ARQUIVADO DA EMPRESA:
                      </label>
                      <select
                        className="form-control form-control-default"
                        value={docContabId}
                        onChange={(e) => {
                          setDocContabId(e.target.value);
                          setFicheiroContab(null);
                        }}
                        style={{ height: 42, fontSize: 13, fontWeight: docContabId ? 600 : 400 }}
                      >
                        <option value="">-- Escolha o Balancete arquivado --</option>
                        {balancetesDisponiveis.map((doc) => (
                          <option key={doc.id} value={String(doc.id)}>
                            {doc.nome_arquivo} ({doc.mes}/{doc.ano})
                          </option>
                        ))}
                      </select>
                      {balancetesDisponiveis.length === 0 && (
                        <div className="mt-8" style={{ fontSize: 12, color: '#2563eb' }}>
                          Nenhum balancete guardado no arquivo para esta empresa. Use a opção "Carregar Ficheiro".
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CAIXA 2: DECLARAÇÃO MODELO 7 (PORTAL AGT) */}
            <div className="col-12 col-lg-6">
              <div className="card card-default h-100" style={{ border: '1px solid #e2e8f0', borderRadius: 14, background: '#ffffff' }}>
                <div className="card-header py-14 px-20 bg-white border-bottom">
                  <div className="d-flex justify-content-between align-items-center flex-wrap w-100" style={{ gap: 10 }}>
                    <strong className="color-dark" style={{ fontSize: 14 }}>
                      <i className="la la-landmark mr-5" style={{ color: '#2563eb' }}></i> 2. Declaração Modelo 7 da AGT (IVA)
                    </strong>
                    <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className={`btn btn-xs ${origemAgt === 'upload' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setOrigemAgt('upload')}
                        style={{ fontSize: 11.5, fontWeight: 600, padding: '5px 12px' }}
                      >
                        Carregar Ficheiro
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs ${origemAgt === 'arquivo' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setOrigemAgt('arquivo')}
                        style={{ fontSize: 11.5, fontWeight: 600, padding: '5px 12px' }}
                      >
                        Do Arquivo ({docsAgtDisponiveis.length})
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card-body p-20 bg-white d-flex flex-column justify-content-center">
                  {origemAgt === 'upload' ? (
                    <div>
                      <input
                        type="file"
                        ref={fileInputAgtRef}
                        accept=".pdf,.xml,.xlsx"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files[0]) {
                            setFicheiroAgt(e.target.files[0]);
                            setDocAgtId('');
                            toast.info(`Declaração AGT selecionada: ${e.target.files[0].name}`);
                          }
                        }}
                      />
                      <div
                        className={`upload-drop-card ${ficheiroAgt ? 'has-file' : ''}`}
                        onClick={() => fileInputAgtRef.current?.click()}
                      >
                        {ficheiroAgt ? (
                          <div>
                            <div className="upload-icon-circle">
                              <i className="la la-check"></i>
                            </div>
                            <strong className="d-block text-dark" style={{ fontSize: 14.5 }}>
                              {ficheiroAgt.name}
                            </strong>
                            <span
                              className="badge mt-6"
                              style={{ fontSize: 11.5, background: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '5px 12px' }}
                            >
                              {formatFileSize(ficheiroAgt.size)} &nbsp;·&nbsp; Pronto para confrontar
                            </span>
                            <div className="mt-12">
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-xs"
                                style={{ padding: '5px 14px', fontSize: 12 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFicheiroAgt(null);
                                  if (fileInputAgtRef.current) fileInputAgtRef.current.value = '';
                                }}
                              >
                                <i className="la la-sync mr-1"></i> Trocar Ficheiro
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="upload-icon-circle">
                              <i className="la la-cloud-upload-alt"></i>
                            </div>
                            <strong className="d-block color-dark" style={{ fontSize: 14.5 }}>
                              Clique aqui para selecionar a Declaração Modelo 7
                            </strong>
                            <span className="text-muted d-block mt-6" style={{ fontSize: 12.5 }}>
                              Suporta o PDF do <strong>Comprovativo de Entrega</strong> gerado no Portal da AGT
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="fw-600 text-muted mb-6" style={{ fontSize: 12 }}>
                        SELECIONE O MODELO 7 JÁ ARQUIVADO DA EMPRESA:
                      </label>
                      <select
                        className="form-control form-control-default"
                        value={docAgtId}
                        onChange={(e) => {
                          setDocAgtId(e.target.value);
                          setFicheiroAgt(null);
                        }}
                        style={{ height: 42, fontSize: 13, fontWeight: docAgtId ? 600 : 400 }}
                      >
                        <option value="">-- Escolha o Modelo 7 arquivado --</option>
                        {docsAgtDisponiveis.map((doc) => (
                          <option key={doc.id} value={String(doc.id)}>
                            {doc.nome_arquivo} ({doc.mes}/{doc.ano})
                          </option>
                        ))}
                      </select>
                      {docsAgtDisponiveis.length === 0 && (
                        <div className="mt-8" style={{ fontSize: 12, color: '#2563eb' }}>
                          Nenhuma declaração guardada no arquivo para esta empresa. Use a opção "Carregar Ficheiro".
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PASSO 2: BOTÃO CENTRAL DE EXECUÇÃO (AZUL INSTITUCIONAL) */}
            <div className="col-12 mt-10 text-center">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={handleExecutarConfronto}
                disabled={executando || !prontoParaConfrontar}
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  padding: '14px 36px',
                  borderRadius: 10,
                  letterSpacing: '0.3px',
                }}
              >
                {executando ? (
                  <>
                    <i className="la la-spinner la-spin mr-8"></i> {etapaTexto || 'A processar confronto com IA...'}
                  </>
                ) : (
                  <>
                    <i className="la la-bolt mr-8"></i> Passo 2: Executar Confronto Automático com Inteligência Artificial
                  </>
                )}
              </button>
              {!prontoParaConfrontar && (
                <div className="text-muted mt-10" style={{ fontSize: 12.5 }}>
                  <i className="la la-info-circle mr-1" style={{ color: '#2563eb' }}></i> Carregue o Balancete (Caixa 1) e o Modelo 7 da AGT (Caixa 2) acima para habilitar o confronto.
                </div>
              )}
            </div>
          </div>

          {/* ESTADO DE PROCESSAMENTO */}
          {executando && (
            <div className="row mb-25 no-print">
              <div className="col-12">
                <div
                  className="card card-default bg-white text-center py-50 d-flex flex-column align-items-center justify-content-center"
                  style={{ border: '1px solid #e2e8f0', borderRadius: 14, minHeight: 220 }}
                >
                  <SpinDots />
                  <h5 className="fw-700 color-dark mt-20 mb-8" style={{ fontSize: 17 }}>
                    {etapaTexto || 'A confrontar Balancete com o Portal da AGT...'}
                  </h5>
                  <p className="text-muted mb-0" style={{ fontSize: 13.5, maxWidth: 650, margin: '0 auto', textAlign: 'center' }}>
                    O motor de inteligência artificial está a extrair e cruzar todos os saldos numéricos do PGC com a Declaração Modelo 7.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3: RELATÓRIO DO CONFRONTO GERADO (100% EM CARTÕES NUMÉRICOS E FUNDO BRANCO) */}
          {!executando && parsedData && (() => {
            const totalRubricas = parsedData.totalPontos || parsedData.itensConfronto.length || 0;
            const rubricasConformes = parsedData.iguaisCount || 0;
            const rubricasDivergentes = parsedData.diferencasCount || 0;
            const indiceConformidade = totalRubricas > 0
              ? Math.round((rubricasConformes / totalRubricas) * 100)
              : 100;

            const liqContabNum = parseValorKz(parsedData.apuramentoIva?.liquidado?.contabilidade);
            const liqAgtNum = parseValorKz(parsedData.apuramentoIva?.liquidado?.agt);
            const desvioLiqNum = Math.abs(liqContabNum - liqAgtNum);
            const desvioLiqTexto = parsedData.apuramentoIva?.liquidado?.status === 'IGUAIS' || desvioLiqNum <= 0.05
              ? '0,00 Kz'
              : (parsedData.apuramentoIva?.liquidado?.diferenca || formatKz(desvioLiqNum));

            const dedContabNum = parseValorKz(parsedData.apuramentoIva?.dedutivel?.contabilidade);
            const dedAgtNum = parseValorKz(parsedData.apuramentoIva?.dedutivel?.agt);
            const desvioDedNum = Math.abs(dedContabNum - dedAgtNum);
            const desvioDedTexto = parsedData.apuramentoIva?.dedutivel?.status === 'IGUAIS' || desvioDedNum <= 0.05
              ? '0,00 Kz'
              : (parsedData.apuramentoIva?.dedutivel?.diferenca || formatKz(desvioDedNum));

            const desvioVendasTexto = parsedData.apuramentoIva?.incidenciaVendas?.status === 'IGUAIS'
              ? '0,00 Kz'
              : (parsedData.apuramentoIva?.incidenciaVendas?.diferenca || '0,00 Kz');

            const desvioComprasTexto = parsedData.apuramentoIva?.incidenciaCompras?.status === 'IGUAIS'
              ? '0,00 Kz'
              : (parsedData.apuramentoIva?.incidenciaCompras?.diferenca || '0,00 Kz');

            const desvioApuramentoTexto = parsedData.apuramentoIva?.confrontoPeriodo?.status === 'IGUAIS'
              ? '0,00 Kz'
              : (parsedData.apuramentoIva?.confrontoPeriodo?.diferenca || '0,00 Kz');

            const corApuramentoPrincipal = parsedData.apuramentoIva?.isRecuperar
              ? '#15803d'
              : parsedData.apuramentoIva?.isReembolso
              ? '#2563eb'
              : '#dc2626';

            return (
              <div id="secao-relatorio-confronto">
                {/* CABEÇALHO TIMBRADO PARA IMPRESSÃO / PDF */}
                <div className="print-only mb-25 pb-15 border-bottom" style={{ borderBottom: '2px solid #0f172a' }}>
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>
                        {empresaAtual?.nome || 'EMPRESA CONTRIBUINTE'}
                      </h2>
                      <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                        <strong>NIF:</strong> {empresaAtual?.nif || '---'} &nbsp;|&nbsp; <strong>Regime IVA:</strong> {empresaAtual?.regime_iva || 'Geral'}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {empresaAtual?.morada || 'República de Angola'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', letterSpacing: '0.5px' }}>
                        RELATÓRIO NUMÉRICO DE CONFRONTO FISCAL
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                        Balancete PGC vs Modelo 7 AGT
                      </div>
                      <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>
                        Período: <strong>{String(mes).padStart(2, '0')}/{ano}</strong> &nbsp;|&nbsp; Emissão: {new Date().toLocaleDateString('pt-PT')}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, padding: '6px 12px', background: '#ffffff', fontSize: 10.5, color: '#334155', borderRadius: 4, border: '1px solid #cbd5e1' }}>
                    <strong>Enquadramento Legal:</strong> Plano Geral de Contabilidade (Decreto Presidencial n.º 82/01), Código do IVA (Lei n.º 7/19) e Código Geral Tributário (Lei n.º 21/14).
                  </div>
                </div>

                {/* BARRA DE AÇÕES DO RELATÓRIO NO ECRÃ (FUNDO BRANCO + BOTÕES AZUIS ESPAÇADOS) */}
                <div className="card card-default mb-25 no-print" style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#ffffff' }}>
                  <div className="card-body py-16 px-22">
                    <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 14 }}>
                      <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
                        <span
                          className="badge"
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            background: '#ffffff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            padding: '6px 12px',
                            borderRadius: 20,
                          }}
                        >
                          ✓ Passo 3 Concluído
                        </span>
                        <strong style={{ fontSize: 14.5, color: '#0f172a' }}>
                          Painel Numérico de Confronto Fiscal
                        </strong>
                      </div>

                      <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
                        {/* Tradução com IA - Botões Azuis com Espaçamento */}
                        <div
                          className="d-flex align-items-center flex-wrap"
                          style={{
                            gap: 8,
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 10,
                            padding: '6px 12px',
                          }}
                        >
                          <span className="fw-600" style={{ fontSize: 12, color: '#475569' }}>
                            <i className="la la-language mr-1" style={{ color: '#2563eb' }}></i> Idioma:
                          </span>
                          <button
                            type="button"
                            className={`btn btn-xs ${idiomaRelatorio === 'pt' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => handleTraduzirRelatorio('pt')}
                            disabled={traduzindo}
                            style={{ fontWeight: 700, borderRadius: 6, fontSize: 11.5, padding: '4px 10px' }}
                            title="Português"
                          >
                            PT
                          </button>
                          <button
                            type="button"
                            className={`btn btn-xs ${idiomaRelatorio === 'en' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => handleTraduzirRelatorio('en')}
                            disabled={traduzindo}
                            style={{ fontWeight: 700, borderRadius: 6, fontSize: 11.5, padding: '4px 10px' }}
                            title="English"
                          >
                            EN
                          </button>
                          <button
                            type="button"
                            className={`btn btn-xs ${idiomaRelatorio === 'zh' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => handleTraduzirRelatorio('zh')}
                            disabled={traduzindo}
                            style={{ fontWeight: 700, borderRadius: 6, fontSize: 11.5, padding: '4px 10px' }}
                            title="中文"
                          >
                            中文
                          </button>
                          {traduzindo && (
                            <span style={{ fontSize: 13, color: '#2563eb' }}>
                              <i className="la la-spinner la-spin"></i>
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleExportarExcel}
                          disabled={exportandoExcel}
                          style={{ fontWeight: 700, padding: '8px 16px', fontSize: 13 }}
                        >
                          <i className={`la ${exportandoExcel ? 'la-spinner la-spin' : 'la-file-excel'} mr-1`}></i>
                          {exportandoExcel ? 'A descarregar...' : 'Exportar Excel (.xlsx)'}
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={handlePrint}
                          style={{ fontWeight: 700, padding: '8px 16px', fontSize: 13 }}
                        >
                          <i className="la la-print mr-1"></i> Imprimir / PDF
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={handleLimparNovoConfronto}
                          style={{ fontWeight: 700, padding: '8px 16px', fontSize: 13 }}
                        >
                          <i className="la la-sync mr-1"></i> Novo Confronto
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECÇÃO 1: QUADRO OFICIAL DE APURAMENTO DO IVA (3 CARTÕES GRANDES EM DESTAQUE) */}
                <div
                  className="card card-default mb-30"
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    background: '#ffffff',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ background: '#ffffff', padding: '20px 26px', borderBottom: '1px solid #e2e8f0' }}>
                    <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
                      <div>
                        <div className="d-flex align-items-center" style={{ gap: 10 }}>
                          <i className="la la-balance-scale" style={{ fontSize: 24, color: '#2563eb' }}></i>
                          <strong style={{ fontSize: 15.5, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#0f172a', fontWeight: 800 }}>
                            Quadro Oficial de Apuramento do IVA (CIVA — Lei n.º 7/19)
                          </strong>
                        </div>
                        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                          Apuramento = <strong>IVA Liquidado (Vendas) − IVA Dedutível (Compras)</strong>
                        </div>
                      </div>
                      <span
                        className="badge"
                        style={{
                          fontSize: 11.5,
                          padding: '7px 14px',
                          fontWeight: 700,
                          border: '1px solid #bfdbfe',
                          color: '#2563eb',
                          background: '#ffffff',
                          borderRadius: '8px',
                        }}
                      >
                        Art. 19.º CIVA · PGC Contas 34.5
                      </span>
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '28px 26px' }}>
                    <div className="row" style={{ rowGap: 26 }}>
                      {/* CARTÃO GRANDE 1: (VENDAS OU SERVIÇOS) */}
                      <div className="col-12 col-lg-4 d-flex flex-column">
                        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                            (VENDAS OU SERVIÇOS)
                          </span>
                        </div>
                        <div className="confronto-big-card" style={{ borderTop: '4px solid #2563eb', padding: '26px 24px' }}>
                          <div>
                            {/* SUB-BLOCO A: INCIDÊNCIA DE VENDAS */}
                            <div className="confronto-subbox" style={{ marginBottom: '20px' }}>
                              <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 6, marginBottom: '12px' }}>
                                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                  Incidência (Base de Vendas)
                                </span>
                                <span className="badge" style={{ fontSize: '10px', background: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 700, padding: '4px 8px' }}>
                                  Conta 61 · Campo 1/1.2
                                </span>
                              </div>
                              <div style={{ marginBottom: '10px' }}>
                                <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                                  Contabilidade (Balancete Conta 61):
                                </span>
                                <div style={{ fontSize: '18.5px', fontWeight: 800, color: '#0f172a' }}>
                                  {parsedData.apuramentoIva?.incidenciaVendas?.contabilidade || '0,00 Kz'}
                                </div>
                              </div>
                              <div style={{ marginBottom: '12px' }}>
                                <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                                  Modelo 7 (Quadro 09 - Campos 1/1.2):
                                </span>
                                <div style={{ fontSize: '18.5px', fontWeight: 800, color: '#0f172a' }}>
                                  {parsedData.apuramentoIva?.incidenciaVendas?.agt || '0,00 Kz'}
                                </div>
                              </div>
                              <div style={{ paddingTop: '10px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Diferença na Base:</span>
                                <span style={{ fontSize: '12.5px', fontWeight: 800, color: parsedData.apuramentoIva?.incidenciaVendas?.status === 'IGUAIS' ? '#15803d' : '#dc2626' }}>
                                  {parsedData.apuramentoIva?.incidenciaVendas?.status === 'IGUAIS' ? '✓ 0,00 Kz' : desvioVendasTexto}
                                </span>
                              </div>
                            </div>

                            {/* SUB-BLOCO B: IVA LIQUIDADO GERADO */}
                            <div style={{ padding: '0 4px' }}>
                              <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 6, marginBottom: '14px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                                  (+) 1. IVA Liquidado (14%)
                                </span>
                                <span className="badge" style={{ fontSize: '10.5px', background: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 700, padding: '4px 8px' }}>
                                  Conta 34.5.3 · C.33
                                </span>
                              </div>
                              <div style={{ marginBottom: '12px' }}>
                                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '3px' }}>
                                  Contabilidade (Conta 34.5.3):
                                </span>
                                <div style={{ fontSize: '23px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                                  {parsedData.apuramentoIva?.liquidado?.contabilidade || '0,00 Kz'}
                                </div>
                              </div>
                              <div>
                                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '3px' }}>
                                  Declaração AGT (Campo 33):
                                </span>
                                <div style={{ fontSize: '23px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                                  {parsedData.apuramentoIva?.liquidado?.agt || '0,00 Kz'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div style={{ paddingTop: '14px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Diferença no IVA:</span>
                            <span className={parsedData.apuramentoIva?.liquidado?.status === 'IGUAIS' ? 'status-badge-conforme' : 'status-badge-divergencia'}>
                              {parsedData.apuramentoIva?.liquidado?.status === 'IGUAIS' ? '✓ 0,00 Kz' : desvioLiqTexto}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CARTÃO GRANDE 2: (COMPRAS OU DESPESAS) */}
                      <div className="col-12 col-lg-4 d-flex flex-column">
                        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                            (COMPRAS OU DESPESAS)
                          </span>
                        </div>
                        <div className="confronto-big-card" style={{ borderTop: '4px solid #2563eb', padding: '26px 24px' }}>
                          <div>
                            {/* SUB-BLOCO A: INCIDÊNCIA DE COMPRAS */}
                            <div className="confronto-subbox" style={{ marginBottom: '20px' }}>
                              <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 6, marginBottom: '12px' }}>
                                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                  Incidência (Compras e FSE)
                                </span>
                                <span className="badge" style={{ fontSize: '10px', background: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 700, padding: '4px 8px' }}>
                                  Conta 21/752 · C.22
                                </span>
                              </div>
                              <div style={{ marginBottom: '10px' }}>
                                <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                                  Contabilidade (Balancete Conta 21):
                                </span>
                                <div style={{ fontSize: '18.5px', fontWeight: 800, color: '#0f172a' }}>
                                  {parsedData.apuramentoIva?.incidenciaCompras?.contabilidade || '0,00 Kz'}
                                </div>
                              </div>
                              <div style={{ marginBottom: '12px' }}>
                                <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                                  Modelo 7 (Quadro 09 - Campo 22):
                                </span>
                                <div style={{ fontSize: '18.5px', fontWeight: 800, color: '#0f172a' }}>
                                  {parsedData.apuramentoIva?.incidenciaCompras?.agt || '0,00 Kz'}
                                </div>
                              </div>
                              <div style={{ paddingTop: '10px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Diferença nas Compras:</span>
                                <span style={{ fontSize: '12.5px', fontWeight: 800, color: parsedData.apuramentoIva?.incidenciaCompras?.status === 'IGUAIS' ? '#15803d' : '#dc2626' }}>
                                  {parsedData.apuramentoIva?.incidenciaCompras?.status === 'IGUAIS' ? '✓ 0,00 Kz' : desvioComprasTexto}
                                </span>
                              </div>
                            </div>

                            {/* SUB-BLOCO B: IVA DEDUTÍVEL */}
                            <div style={{ padding: '0 4px' }}>
                              <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 6, marginBottom: '14px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                                  (−) 2. IVA Dedutível
                                </span>
                                <span className="badge" style={{ fontSize: '10.5px', background: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 700, padding: '4px 8px' }}>
                                  Conta 34.5.1/2 · C.32
                                </span>
                              </div>
                              <div style={{ marginBottom: '12px' }}>
                                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '3px' }}>
                                  Contabilidade (Conta 34.5.1/34.5.2):
                                </span>
                                <div style={{ fontSize: '23px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                                  {parsedData.apuramentoIva?.dedutivel?.contabilidade || '0,00 Kz'}
                                </div>
                              </div>
                              <div>
                                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '3px' }}>
                                  Declaração AGT (Campo 32):
                                </span>
                                <div style={{ fontSize: '23px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                                  {parsedData.apuramentoIva?.dedutivel?.agt || '0,00 Kz'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div style={{ paddingTop: '14px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Diferença no IVA:</span>
                            <span className={parsedData.apuramentoIva?.dedutivel?.status === 'IGUAIS' ? 'status-badge-conforme' : 'status-badge-divergencia'}>
                              {parsedData.apuramentoIva?.dedutivel?.status === 'IGUAIS' ? '✓ 0,00 Kz' : desvioDedTexto}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CARTÃO GRANDE 3: APURAMENTO DO IVA */}
                      <div className="col-12 col-lg-4 d-flex flex-column">
                        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                            APURAMENTO DO IVA
                          </span>
                        </div>
                        <div
                          className="confronto-big-card"
                          style={{
                            borderTop: `4px solid ${corApuramentoPrincipal}`,
                            padding: '26px 24px',
                          }}
                        >
                          <div>
                            <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 6, marginBottom: '16px' }}>
                              <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                                {parsedData.apuramentoIva?.tituloCard3 || '(=) 3. Apuramento do IVA'}
                              </span>
                              <span
                                className="badge"
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  background: '#ffffff',
                                  color: corApuramentoPrincipal,
                                  border: `1px solid ${parsedData.apuramentoIva?.isRecuperar ? '#86efac' : parsedData.apuramentoIva?.isReembolso ? '#bfdbfe' : '#fca5a5'}`,
                                  padding: '4px 10px',
                                }}
                              >
                                {parsedData.apuramentoIva?.rubricaCard3 || 'Conta 34.5'}
                              </span>
                            </div>

                            {/* APURAMENTO DOCUMENTO 1: CONTABILIDADE */}
                            <div className="confronto-subbox" style={{ marginBottom: '14px' }}>
                              <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                                  1. Contabilidade (Balancete)
                                </span>
                                <span className="badge" style={{ fontSize: '10px', background: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 700, padding: '3px 7px' }}>
                                  {parsedData.apuramentoIva?.apuramentoContabilidade?.conta || 'Conta 34.5'}
                                </span>
                              </div>
                              <div style={{ fontSize: '23px', fontWeight: 800, color: corApuramentoPrincipal, letterSpacing: '-0.3px' }}>
                                {parsedData.apuramentoIva?.apuramentoContabilidade?.saldo || parsedData.apuramentoIva?.resultadoPrincipal?.contabilidade || '0,00 Kz'}
                              </div>
                              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                                {parsedData.apuramentoIva?.isRecuperar ? 'Crédito Fiscal do Período' : parsedData.apuramentoIva?.isReembolso ? 'Reembolso Pedido' : 'IVA a Pagar do Período'}
                              </span>
                            </div>

                            {/* APURAMENTO DOCUMENTO 2: AGT (MODELO 7) */}
                            <div className="confronto-subbox">
                              <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                                  2. Declaração AGT (Modelo 7)
                                </span>
                                <span className="badge" style={{ fontSize: '10px', background: '#ffffff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 700, padding: '3px 7px' }}>
                                  {parsedData.apuramentoIva?.apuramentoAgt?.campo || 'Quadro 10'}
                                </span>
                              </div>
                              <div style={{ fontSize: '23px', fontWeight: 800, color: corApuramentoPrincipal, letterSpacing: '-0.3px' }}>
                                {parsedData.apuramentoIva?.apuramentoAgt?.saldoPeriodo || parsedData.apuramentoIva?.resultadoPrincipal?.agt || '0,00 Kz'}
                              </div>
                              {parsedData.apuramentoIva?.apuramentoAgt?.excessoAnterior && (
                                <div style={{ fontSize: '11.5px', color: '#334155', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
                                  <div className="d-flex justify-content-between mb-4">
                                    <span style={{ color: '#64748b' }}>(+) Excesso Anterior (C.36):</span>
                                    <strong>{parsedData.apuramentoIva.apuramentoAgt.excessoAnterior}</strong>
                                  </div>
                                  <div className="d-flex justify-content-between">
                                    <span style={{ color: '#64748b' }}>(=) Acumulado Final (C.39):</span>
                                    <strong style={{ color: '#15803d', fontSize: '13px' }}>{parsedData.apuramentoIva.apuramentoAgt.posicaoFinal}</strong>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ paddingTop: '14px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Confronto do Período:</span>
                            <span className={parsedData.apuramentoIva?.confrontoPeriodo?.status === 'IGUAIS' ? 'status-badge-conforme' : 'status-badge-divergencia'}>
                              {parsedData.apuramentoIva?.confrontoPeriodo?.status === 'IGUAIS'
                                ? '✓ IGUAIS (0,00 Kz)'
                                : `⚠️ ${desvioApuramentoTexto}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECÇÃO 2: ANÁLISE NUMÉRICA EXECUTIVA (3 CARTÕES GRANDES EM BAIXO — ZERO TEXTOS LONGOS) */}
                <div
                  className="card card-default mb-30"
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    background: '#ffffff',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ background: '#ffffff', padding: '20px 26px', borderBottom: '1px solid #e2e8f0' }}>
                    <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
                      <div>
                        <div className="d-flex align-items-center" style={{ gap: 10 }}>
                          <i className="la la-chart-bar" style={{ fontSize: 24, color: '#2563eb' }}></i>
                          <strong style={{ fontSize: 15.5, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#0f172a', fontWeight: 800 }}>
                            Diagnóstico Numérico da Análise & Posição Contabilística
                          </strong>
                        </div>
                        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                          Síntese quantitativa de conformidade, desvios financeiros em Kwanzas e saldos das contas 34.5
                        </div>
                      </div>
                      <span
                        className="badge"
                        style={{
                          fontSize: 11.5,
                          padding: '7px 14px',
                          fontWeight: 700,
                          border: '1px solid #bfdbfe',
                          color: '#2563eb',
                          background: '#ffffff',
                          borderRadius: '8px',
                        }}
                      >
                        {totalRubricas} Rubricas Auditadas
                      </span>
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '28px 26px' }}>
                    <div className="row" style={{ rowGap: 26 }}>
                      {/* CARTÃO NUMÉRICO 4: (ÍNDICE DE CONFORMIDADE) */}
                      <div className="col-12 col-lg-4 d-flex flex-column">
                        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                            (ÍNDICE DE CONFORMIDADE)
                          </span>
                        </div>
                        <div className="confronto-big-card" style={{ borderTop: `4px solid ${rubricasDivergentes === 0 ? '#15803d' : '#dc2626'}`, padding: '26px 24px' }}>
                          <div>
                            <div className="confronto-subbox" style={{ marginBottom: '20px', textAlign: 'center' }}>
                              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '6px' }}>
                                Taxa de Precisão Contabilística
                              </span>
                              <div style={{ fontSize: '36px', fontWeight: 800, color: rubricasDivergentes === 0 ? '#15803d' : '#2563eb', lineHeight: 1.1 }}>
                                {indiceConformidade}%
                              </div>
                              <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '6px' }}>
                                {rubricasConformes} de {totalRubricas} rubricas coincidentes
                              </span>
                            </div>

                            <div style={{ padding: '0 4px' }}>
                              <div className="d-flex justify-content-between align-items-center" style={{ padding: '10px 0', borderBottom: '1px dashed #e2e8f0' }}>
                                <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>Total Confrontado:</span>
                                <span style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{totalRubricas}</span>
                              </div>
                              <div className="d-flex justify-content-between align-items-center" style={{ padding: '10px 0', borderBottom: '1px dashed #e2e8f0' }}>
                                <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>Rubricas Iguais:</span>
                                <span style={{ fontSize: '20px', fontWeight: 800, color: '#15803d' }}>{rubricasConformes}</span>
                              </div>
                              <div className="d-flex justify-content-between align-items-center" style={{ padding: '10px 0' }}>
                                <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>Rubricas com Diferença:</span>
                                <span style={{ fontSize: '20px', fontWeight: 800, color: rubricasDivergentes > 0 ? '#dc2626' : '#15803d' }}>
                                  {rubricasDivergentes}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div style={{ paddingTop: '14px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Risco Fiscal:</span>
                            <span className={rubricasDivergentes === 0 ? 'status-badge-conforme' : 'status-badge-divergencia'}>
                              {rubricasDivergentes === 0 ? '✓ NULO (CONFORME)' : `⚠️ ${rubricasDivergentes} ALERTA(S)`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CARTÃO NUMÉRICO 5: (DESVIOS FINANCEIROS EM KWANZAS) */}
                      <div className="col-12 col-lg-4 d-flex flex-column">
                        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                            (DESVIOS EM KWANZAS)
                          </span>
                        </div>
                        <div className="confronto-big-card" style={{ borderTop: '4px solid #2563eb', padding: '26px 24px' }}>
                          <div>
                            <div className="confronto-subbox" style={{ marginBottom: '20px' }}>
                              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                                Diferenças nas Bases Tributáveis
                              </span>
                              <div className="d-flex justify-content-between align-items-center mb-8">
                                <span style={{ fontSize: '12px', color: '#64748b' }}>Base Vendas (Conta 61):</span>
                                <strong style={{ fontSize: '15.5px', color: desvioVendasTexto === '0,00 Kz' ? '#15803d' : '#dc2626' }}>
                                  {desvioVendasTexto}
                                </strong>
                              </div>
                              <div className="d-flex justify-content-between align-items-center">
                                <span style={{ fontSize: '12px', color: '#64748b' }}>Base Compras (Conta 21):</span>
                                <strong style={{ fontSize: '15.5px', color: desvioComprasTexto === '0,00 Kz' ? '#15803d' : '#dc2626' }}>
                                  {desvioComprasTexto}
                                </strong>
                              </div>
                            </div>

                            <div style={{ padding: '0 4px' }}>
                              <div style={{ marginBottom: '14px' }}>
                                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '3px' }}>
                                  Desvio no IVA Liquidado (C.33):
                                </span>
                                <div style={{ fontSize: '21px', fontWeight: 800, color: desvioLiqTexto === '0,00 Kz' ? '#15803d' : '#dc2626' }}>
                                  {desvioLiqTexto}
                                </div>
                              </div>
                              <div>
                                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '3px' }}>
                                  Desvio no IVA Dedutível (C.32):
                                </span>
                                <div style={{ fontSize: '21px', fontWeight: 800, color: desvioDedTexto === '0,00 Kz' ? '#15803d' : '#dc2626' }}>
                                  {desvioDedTexto}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div style={{ paddingTop: '14px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Desvio no Apuramento:</span>
                            <span className={desvioApuramentoTexto === '0,00 Kz' ? 'status-badge-conforme' : 'status-badge-divergencia'}>
                              {desvioApuramentoTexto === '0,00 Kz' ? '✓ 0,00 Kz' : desvioApuramentoTexto}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CARTÃO NUMÉRICO 6: (SALDOS PGC 34.5 & OBRIGAÇÃO FISCAL) */}
                      <div className="col-12 col-lg-4 d-flex flex-column">
                        <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                            (SALDOS CONTAS PGC 34.5)
                          </span>
                        </div>
                        <div className="confronto-big-card" style={{ borderTop: `4px solid ${corApuramentoPrincipal}`, padding: '26px 24px' }}>
                          <div>
                            <div className="confronto-subbox" style={{ marginBottom: '20px' }}>
                              <div className="d-flex justify-content-between align-items-center mb-10">
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>34.5.6.1 · IVA a Pagar:</span>
                                <strong style={{ fontSize: '15.5px', color: parsedData.apuramentoIva?.tipoApuramento === 'PAGAR' ? '#dc2626' : '#64748b' }}>
                                  {parsedData.apuramentoIva?.tipoApuramento === 'PAGAR'
                                    ? (parsedData.apuramentoIva?.pagar?.agt || '0,00 Kz')
                                    : '0,00 Kz'}
                                </strong>
                              </div>
                              <div className="d-flex justify-content-between align-items-center mb-10">
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>34.5.7.1 · IVA a Recuperar:</span>
                                <strong style={{ fontSize: '15.5px', color: parsedData.apuramentoIva?.tipoApuramento === 'RECUPERAR' ? '#15803d' : '#64748b' }}>
                                  {parsedData.apuramentoIva?.tipoApuramento === 'RECUPERAR'
                                    ? (parsedData.apuramentoIva?.recuperar?.agt || '0,00 Kz')
                                    : '0,00 Kz'}
                                </strong>
                              </div>
                              <div className="d-flex justify-content-between align-items-center">
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>34.5.8.1 · Reembolsos:</span>
                                <strong style={{ fontSize: '15.5px', color: parsedData.apuramentoIva?.tipoApuramento === 'REEMBOLSO' ? '#2563eb' : '#64748b' }}>
                                  {parsedData.apuramentoIva?.tipoApuramento === 'REEMBOLSO'
                                    ? (parsedData.apuramentoIva?.reembolso?.agt || '0,00 Kz')
                                    : '0,00 Kz'}
                                </strong>
                              </div>
                            </div>

                            <div style={{ padding: '0 4px' }}>
                              <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                                {parsedData.apuramentoIva?.isRecuperar
                                  ? 'Crédito Fiscal Acumulado p/ Mês Seguinte (C.39):'
                                  : parsedData.apuramentoIva?.isReembolso
                                  ? 'Reembolso Solicitado à AGT (C.40):'
                                  : 'Valor Líquido a Pagar via DAR (C.37):'}
                              </span>
                              <div style={{ fontSize: '25px', fontWeight: 800, color: corApuramentoPrincipal, letterSpacing: '-0.3px' }}>
                                {parsedData.apuramentoIva?.apuramentoAgt?.posicaoFinal ||
                                  parsedData.apuramentoIva?.resultadoPrincipal?.agt ||
                                  '0,00 Kz'}
                              </div>
                              <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                                DAR a Pagar neste mês:{' '}
                                <strong style={{ color: '#0f172a' }}>
                                  {parsedData.apuramentoIva?.isRecuperar || parsedData.apuramentoIva?.isReembolso
                                    ? '0,00 Kz'
                                    : (parsedData.apuramentoIva?.apuramentoAgt?.posicaoFinal || parsedData.apuramentoIva?.pagar?.agt || '0,00 Kz')}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <div style={{ paddingTop: '14px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 700 }}>Conta Ativa:</span>
                            <span
                              className="badge"
                              style={{
                                background: '#ffffff',
                                color: '#2563eb',
                                border: '1px solid #bfdbfe',
                                fontWeight: 800,
                                fontSize: '12px',
                                padding: '5px 12px',
                                borderRadius: '20px',
                              }}
                            >
                              {parsedData.apuramentoIva?.apuramentoContabilidade?.conta || 'Conta 34.5'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECÇÃO 3: TODAS AS RUBRICAS CONFRONTADAS EM CARTÕES NUMÉRICOS INDIVIDUAIS */}
                {parsedData.itensConfronto && parsedData.itensConfronto.length > 0 && (
                  <div
                    className="card card-default mb-30"
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      background: '#ffffff',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ background: '#ffffff', padding: '18px 26px', borderBottom: '1px solid #e2e8f0' }}>
                      <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
                        <div className="d-flex align-items-center" style={{ gap: 10 }}>
                          <i className="la la-th-large" style={{ fontSize: 22, color: '#2563eb' }}></i>
                          <strong style={{ fontSize: 15, letterSpacing: '0.3px', textTransform: 'uppercase', color: '#0f172a', fontWeight: 800 }}>
                            Rubricas Confrontadas (Balancete PGC vs Modelo 7 AGT)
                          </strong>
                        </div>
                        <span
                          className="badge"
                          style={{
                            fontSize: 11.5,
                            padding: '6px 12px',
                            fontWeight: 700,
                            border: '1px solid #e2e8f0',
                            color: '#475569',
                            background: '#ffffff',
                            borderRadius: '8px',
                          }}
                        >
                          Comparação Rubrica a Rubrica
                        </span>
                      </div>
                    </div>

                    <div style={{ background: '#ffffff', padding: '24px 26px' }}>
                      <div className="row" style={{ rowGap: 20 }}>
                        {parsedData.itensConfronto.map((item, idx) => {
                          const isOk = item.status === 'IGUAIS' || item.status === 'OK' || item.status === 'CONFORME';
                          return (
                            <div key={idx} className="col-12 col-md-6 col-xl-4 d-flex">
                              <div
                                style={{
                                  background: '#ffffff',
                                  border: `1px solid ${isOk ? '#e2e8f0' : '#fca5a5'}`,
                                  borderTop: `3px solid ${isOk ? '#2563eb' : '#dc2626'}`,
                                  borderRadius: '12px',
                                  padding: '20px',
                                  width: '100%',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  gap: '14px',
                                }}
                              >
                                <div>
                                  <div className="d-flex justify-content-between align-items-start" style={{ gap: 10, marginBottom: '14px' }}>
                                    <strong style={{ fontSize: '13.5px', color: '#0f172a', fontWeight: 800, lineHeight: 1.35 }}>
                                      {item.campo}
                                    </strong>
                                    <span className={isOk ? 'status-badge-conforme' : 'status-badge-divergencia'} style={{ flexShrink: 0 }}>
                                      {isOk ? '✓ IGUAIS' : '⚠️ DIFERENÇA'}
                                    </span>
                                  </div>

                                  <div className="d-flex justify-content-between align-items-center" style={{ padding: '8px 0', borderBottom: '1px dashed #e2e8f0' }}>
                                    <span style={{ fontSize: '12px', color: '#64748b' }}>Contabilidade (PGC):</span>
                                    <strong style={{ fontSize: '16px', color: '#0f172a', fontWeight: 800 }}>{item.contabilidade}</strong>
                                  </div>

                                  <div className="d-flex justify-content-between align-items-center" style={{ padding: '8px 0' }}>
                                    <span style={{ fontSize: '12px', color: '#64748b' }}>Modelo 7 (AGT):</span>
                                    <strong style={{ fontSize: '16px', color: '#0f172a', fontWeight: 800 }}>{item.agt}</strong>
                                  </div>
                                </div>

                                <div style={{ paddingTop: '10px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px', color: '#475569', fontWeight: 700 }}>Diferença:</span>
                                  <strong style={{ fontSize: '14.5px', fontWeight: 800, color: isOk ? '#15803d' : '#dc2626' }}>
                                    {isOk ? '0,00 Kz' : item.diferenca}
                                  </strong>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* BOTÃO OPCIONAL E DISCRETO PARA PARECER TÉCNICO EM TEXTO (SE O CONTABILISTA QUISER CONSULTAR) */}
                {resultadoRaw && (
                  <div className="mb-30 no-print">
                    <div className="text-center">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => setVisualizacaoTexto(!visualizacaoTexto)}
                        style={{ fontWeight: 700, padding: '10px 22px', fontSize: 13, borderRadius: 10 }}
                      >
                        <i className={`la ${visualizacaoTexto ? 'la-chevron-up' : 'la-file-alt'} mr-2`}></i>
                        {visualizacaoTexto
                          ? 'Ocultar Parecer Técnico Detalhado da IA'
                          : 'Ver Fundamentação Legal e Parecer Detalhado da IA (Opcional)'}
                      </button>
                    </div>

                    {visualizacaoTexto && (
                      <div
                        className="card card-default mt-15"
                        style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#ffffff' }}
                      >
                        <div
                          className="card-header py-14 px-22 border-bottom d-flex justify-content-between align-items-center"
                          style={{ background: '#ffffff' }}
                        >
                          <strong style={{ fontSize: 14, color: '#0f172a' }}>
                            <i className="la la-file-text mr-2" style={{ color: '#2563eb' }}></i>
                            Parecer Pericial Completo ({idiomaRelatorio === 'zh' ? '中文' : idiomaRelatorio === 'en' ? 'English' : 'Português'})
                          </strong>
                          <button
                            type="button"
                            className="btn btn-xs btn-outline-primary"
                            onClick={() => {
                              navigator.clipboard.writeText(resultadoRaw);
                              toast.info('Parecer copiado para a área de transferência.');
                            }}
                          >
                            <i className="la la-copy mr-1"></i> Copiar Parecer
                          </button>
                        </div>
                        <div
                          className="card-body p-25"
                          style={{
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.7,
                            fontSize: 13.5,
                            color: '#1e293b',
                            background: '#ffffff',
                          }}
                        >
                          {resultadoRaw}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* BLOCO DE ASSINATURAS OFICIAIS (IMPRESSÃO / PDF) */}
                <div className="print-only mt-40 pt-20" style={{ pageBreakInside: 'avoid', borderTop: '1px solid #cbd5e1' }}>
                  <div className="row" style={{ marginTop: 20 }}>
                    <div className="col-6 text-center">
                      <div style={{ borderTop: '1px solid #0f172a', width: '85%', margin: '0 auto', paddingTop: 8 }}>
                        <strong style={{ fontSize: 12, display: 'block', color: '#0f172a' }}>
                          O CONTABILISTA CERTIFICADO
                        </strong>
                        <span style={{ fontSize: 10.5, color: '#475569', display: 'block' }}>
                          Ordem dos Contabilistas e Peritos Contabilistas de Angola (OCPCA)
                        </span>
                        <span style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 4 }}>
                          Cédula Profissional N.º: ___________________________
                        </span>
                      </div>
                    </div>

                    <div className="col-6 text-center">
                      <div style={{ borderTop: '1px solid #0f172a', width: '85%', margin: '0 auto', paddingTop: 8 }}>
                        <strong style={{ fontSize: 12, display: 'block', color: '#0f172a' }}>
                          A GERÊNCIA / CONSELHO DE ADMINISTRAÇÃO
                        </strong>
                        <span style={{ fontSize: 10.5, color: '#475569', display: 'block' }}>
                          {empresaAtual?.nome || 'A Empresa Contribuinte'}
                        </span>
                        <span style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 4 }}>
                          (Assinatura e Carimbo Oficial)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mt-30" style={{ fontSize: 9.5, color: '#64748b' }}>
                    Documento emitido eletronicamente pela Plataforma de Reconciliação Contabilística & Fiscal de Angola — Cópia autêntica para integração no Dossier Fiscal da Empresa.
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </>
  );
};

export default ConfrontoView;
