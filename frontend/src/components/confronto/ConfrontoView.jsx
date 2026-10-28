import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { usePeriodo, usePeriodoDaUrl } from '../../context/PeriodoContext';
import { empresaService, analiseService, authHeaders, API_BASE } from '../../services/api';
import { parseAnaliseIA } from '../../utils/analiseIaParser';
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
  const { empresaId, ano, mes, atualizar, escolherSeAusente } = usePeriodo();
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

  const parsedData = useMemo(() => {
    if (!resultadoRaw) return null;
    return parseAnaliseIA(resultadoRaw);
  }, [resultadoRaw]);

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
        .step-pill {
          padding: 8px 16px;
          border-radius: 8px;
          background: #f4f6f9;
          font-weight: 700;
          font-size: 12.5px;
          color: #495057;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .step-pill.active {
          background: #e8ebfc;
          color: #1a3353;
          border: 1px solid #c2c9f5;
        }
        .upload-drop-card {
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          padding: 24px 20px;
          text-align: center;
          background: #ffffff;
          transition: all 0.25s ease;
          cursor: pointer;
        }
        .upload-drop-card:hover {
          border-color: #5f63f2;
          background: #fbfbfe;
          box-shadow: 0 6px 16px rgba(95, 99, 242, 0.06);
        }
        .upload-drop-card.has-file {
          border: 2px solid #52c41a;
          background: #f6ffed;
        }
        .confronto-kpi-card {
          border: 1px solid #edf0f5;
          border-radius: 10px;
          background: #ffffff;
          padding: 18px 20px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .confronto-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.06);
        }
        .status-badge-conforme {
          background-color: #e6f7ef;
          color: #00a854;
          border: 1px solid #b7eb8f;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 11.5px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .status-badge-divergencia {
          background-color: #fff1f0;
          color: #f5222d;
          border: 1px solid #ffa39e;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 11.5px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .diff-box {
          border-left: 4px solid #f5222d;
          background: #fafafa;
          border-radius: 0 8px 8px 0;
          padding: 14px 18px;
          margin-bottom: 12px;
        }
        .diff-box-ok {
          border-left: 4px solid #52c41a;
          background: #fafafa;
          border-radius: 0 8px 8px 0;
          padding: 12px 18px;
          margin-bottom: 8px;
        }
        .rec-item-card {
          background: #ffffff;
          border: 1px solid #edf0f5;
          border-radius: 8px;
          padding: 14px 18px;
          margin-bottom: 10px;
          display: flex;
          gap: 14px;
          align-items: flex-start;
        }
        .rec-badge-number {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #1a3353;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          flex-shrink: 0;
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
          .card { border: 1px solid #dcdfe5 !important; box-shadow: none !important; page-break-inside: avoid; }
          .confronto-kpi-card { border: 1px solid #dcdfe5 !important; box-shadow: none !important; page-break-inside: avoid; }
          @page { margin: 12mm; size: A4 portrait; }
        }
        `}
      </style>

      {/* CABEÇALHO DA PÁGINA COM NAVEGAÇÃO LIMPA */}
      <div className="row mb-20 no-print pt-10">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
            <div>
              <h4 className="fw-800 color-dark mb-4" style={{ fontSize: 22, color: '#1a3353' }}>
                <i className="la la-balance-scale text-primary mr-6"></i>{' '}
                Confronto Contabilidade vs Portal AGT
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: 13.5 }}>
                Cruzamento inteligente em 3 passos simples: carregue o Balancete e o Modelo 7 para apurar diferenças e gerar o relatório fiscal.
              </p>
            </div>

            {/* SELEÇÃO DE ABAS */}
            <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
              <div className="btn-group" role="group">
                <button
                  type="button"
                  className={`btn btn-sm ${abaAtiva === 'confronto' ? 'btn-primary' : 'btn-outline-lighten bg-white'}`}
                  onClick={() => setAbaAtiva('confronto')}
                  style={{ fontWeight: 700, fontSize: 13 }}
                >
                  <i className="la la-bolt mr-4"></i> 1. Confronto com IA
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${abaAtiva === 'consolidacao' ? 'btn-primary' : 'btn-outline-lighten bg-white'}`}
                  onClick={() => setAbaAtiva('consolidacao')}
                  style={{ fontWeight: 700, fontSize: 13 }}
                >
                  <i className="la la-calendar-check mr-4"></i> 2. Consolidação Anual (12 Meses)
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${abaAtiva === 'historico' ? 'btn-primary' : 'btn-outline-lighten bg-white'}`}
                  onClick={() => setAbaAtiva('historico')}
                  style={{ fontWeight: 700, fontSize: 13 }}
                >
                  <i className="la la-history mr-4"></i> 3. Histórico ({historico.length})
                </button>
              </div>
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
            <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
              <div className="card-header py-12 px-20 bg-light border-bottom">
                <strong className="color-dark" style={{ fontSize: 14 }}>
                  <i className="la la-history text-primary mr-5"></i> Relatórios de Confronto Realizados Anteriormente
                </strong>
              </div>
              <div className="card-body p-0">
                {carregandoHistorico ? (
                  <div className="text-center py-40">
                    <SpinDots />
                    <p className="text-muted mt-10">A carregar histórico...</p>
                  </div>
                ) : historico.length === 0 ? (
                  <div className="text-center py-40">
                    <div style={{ fontSize: 36 }}>📊</div>
                    <h5 className="mt-10">Nenhum confronto gravado no histórico</h5>
                    <p className="text-muted">Execute o primeiro confronto para arquivar o relatório.</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0" style={{ fontSize: 13 }}>
                      <thead style={{ backgroundColor: '#f9fafb' }}>
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
                              <i className="la la-book text-primary mr-1"></i>
                              {item.documento_contabilidade?.nome_arquivo || 'Balancete'}
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <i className="la la-landmark text-info mr-1"></i>
                              {item.documento_agt?.nome_arquivo || 'Modelo 7'}
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <span className="badge badge-success" style={{ fontSize: 11 }}>
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
              <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10, background: '#ffffff' }}>
                <div className="card-body py-15 px-20">
                  <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
                    <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
                      <div className={`step-pill ${!resultadoRaw ? 'active' : ''}`}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1a3353', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                          1
                        </span>
                        <span>Carregar Balancete & Modelo 7</span>
                      </div>
                      <span className="text-muted">&rarr;</span>
                      <div className={`step-pill ${executando ? 'active' : ''}`}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1a3353', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                          2
                        </span>
                        <span>Confrontar com IA</span>
                      </div>
                      <span className="text-muted">&rarr;</span>
                      <div className={`step-pill ${resultadoRaw ? 'active' : ''}`}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1a3353', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                          3
                        </span>
                        <span>Ver Relatório, Excel & PDF</span>
                      </div>
                    </div>

                    {/* SELETOR DE EMPRESA ATIVA */}
                    <div className="d-flex align-items-center" style={{ gap: 8 }}>
                      <span className="text-muted fw-600" style={{ fontSize: 12 }}>EMPRESA:</span>
                      {isAdmin ? (
                        <>
                          <select
                            className="form-control form-control-sm"
                            value={empresaId}
                            onChange={(e) => atualizar({ empresaId: e.target.value })}
                            style={{ height: 34, fontSize: 12.5, fontWeight: 700, minWidth: 200 }}
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
                            style={{ height: 34, width: 34, borderRadius: 6, padding: 0 }}
                            title="Cadastrar Nova Empresa"
                          >
                            <i className="la la-plus" style={{ fontSize: 16 }}></i>
                          </button>
                        </>
                      ) : (
                        <div
                          className="px-12 py-6 bg-white rounded border fw-700 color-dark text-truncate d-flex align-items-center"
                          style={{ height: 34, fontSize: 12.5, maxWidth: 300 }}
                          title={empresas.find((e) => String(e.id) === String(empresaId))?.nome || 'Minha Empresa'}
                        >
                          <i className="la la-building mr-1 text-primary"></i>
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

          {/* PASSO 1: CAIXAS DE CARREGAMENTO DOS 2 FICHEIROS */}
          <div className="row mb-25 no-print" style={{ rowGap: 16 }}>
            {/* CAIXA 1: BALANCETE DA CONTABILIDADE */}
            <div className="col-12 col-lg-6">
              <div className="card card-default h-100" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
                <div className="card-header py-12 px-20 bg-light border-bottom">
                  <div className="d-flex justify-content-between align-items-center w-100">
                    <strong className="color-dark" style={{ fontSize: 13.5 }}>
                      <i className="la la-book text-primary mr-5"></i> 1. Balancete de Verificação (PGC)
                    </strong>
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn btn-xs ${origemContab === 'upload' ? 'btn-primary text-white' : 'btn-outline-lighten bg-white'}`}
                        onClick={() => setOrigemContab('upload')}
                        style={{ fontSize: 11, fontWeight: 600 }}
                      >
                        Carregar Ficheiro
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs ${origemContab === 'arquivo' ? 'btn-primary text-white' : 'btn-outline-lighten bg-white'}`}
                        onClick={() => setOrigemContab('arquivo')}
                        style={{ fontSize: 11, fontWeight: 600 }}
                      >
                        Do Arquivo ({balancetesDisponiveis.length})
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card-body p-20 d-flex flex-column justify-content-center">
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
                            <div style={{ fontSize: 36 }} className="text-success mb-5">✓</div>
                            <strong className="d-block text-dark" style={{ fontSize: 14 }}>
                              {ficheiroContab.name}
                            </strong>
                            <span className="badge badge-success mt-4" style={{ fontSize: 11.5 }}>
                              {formatFileSize(ficheiroContab.size)} &nbsp;·&nbsp; Pronto para confrontar
                            </span>
                            <div className="mt-8">
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFicheiroContab(null);
                                  if (fileInputContabRef.current) fileInputContabRef.current.value = '';
                                }}
                              >
                                Trocar Ficheiro
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 36 }} className="text-primary mb-5">📄</div>
                            <strong className="d-block color-dark" style={{ fontSize: 14 }}>
                              Clique aqui para selecionar o Balancete
                            </strong>
                            <span className="text-muted d-block mt-4" style={{ fontSize: 12 }}>
                              Suporta ficheiros em <strong>PDF</strong> ou folha de cálculo <strong>Excel (.xlsx)</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
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
                            📄 {doc.nome_arquivo} ({doc.mes}/{doc.ano})
                          </option>
                        ))}
                      </select>
                      {balancetesDisponiveis.length === 0 && (
                        <div className="text-warning mt-8" style={{ fontSize: 12 }}>
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
              <div className="card card-default h-100" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
                <div className="card-header py-12 px-20 bg-light border-bottom">
                  <div className="d-flex justify-content-between align-items-center w-100">
                    <strong className="color-dark" style={{ fontSize: 13.5 }}>
                      <i className="la la-landmark text-primary mr-5"></i> 2. Declaração Modelo 7 da AGT (IVA)
                    </strong>
                    <div className="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        className={`btn btn-xs ${origemAgt === 'upload' ? 'btn-primary text-white' : 'btn-outline-lighten bg-white'}`}
                        onClick={() => setOrigemAgt('upload')}
                        style={{ fontSize: 11, fontWeight: 600 }}
                      >
                        Carregar Ficheiro
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs ${origemAgt === 'arquivo' ? 'btn-primary text-white' : 'btn-outline-lighten bg-white'}`}
                        onClick={() => setOrigemAgt('arquivo')}
                        style={{ fontSize: 11, fontWeight: 600 }}
                      >
                        Do Arquivo ({docsAgtDisponiveis.length})
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card-body p-20 d-flex flex-column justify-content-center">
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
                            <div style={{ fontSize: 36 }} className="text-success mb-5">✓</div>
                            <strong className="d-block text-dark" style={{ fontSize: 14 }}>
                              {ficheiroAgt.name}
                            </strong>
                            <span className="badge badge-success mt-4" style={{ fontSize: 11.5 }}>
                              {formatFileSize(ficheiroAgt.size)} &nbsp;·&nbsp; Pronto para confrontar
                            </span>
                            <div className="mt-8">
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFicheiroAgt(null);
                                  if (fileInputAgtRef.current) fileInputAgtRef.current.value = '';
                                }}
                              >
                                Trocar Ficheiro
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 36 }} className="text-primary mb-5">🏛️</div>
                            <strong className="d-block color-dark" style={{ fontSize: 14 }}>
                              Clique aqui para selecionar a Declaração Modelo 7
                            </strong>
                            <span className="text-muted d-block mt-4" style={{ fontSize: 12 }}>
                              Suporta o PDF do <strong>Comprovativo de Entrega</strong> gerado no Portal da AGT
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="fw-600 text-muted mb-4" style={{ fontSize: 12 }}>
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
                            🏛️ {doc.nome_arquivo} ({doc.mes}/{doc.ano})
                          </option>
                        ))}
                      </select>
                      {docsAgtDisponiveis.length === 0 && (
                        <div className="text-warning mt-8" style={{ fontSize: 12 }}>
                          Nenhuma declaração guardada no arquivo para esta empresa. Use a opção "Carregar Ficheiro".
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PASSO 2: BOTÃO CENTRAL DE EXECUÇÃO */}
            <div className="col-12 mt-10 text-center">
              <button
                type="button"
                className="btn btn-primary btn-lg shadow-sm"
                onClick={handleExecutarConfronto}
                disabled={executando || !prontoParaConfrontar}
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  padding: '14px 36px',
                  borderRadius: 30,
                  backgroundColor: prontoParaConfrontar ? '#1a3353' : '#a0aec0',
                  borderColor: prontoParaConfrontar ? '#1a3353' : '#a0aec0',
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
                <div className="text-muted mt-8" style={{ fontSize: 12 }}>
                  <i className="la la-info-circle mr-1"></i> Carregue o Balancete (Caixa 1) e o Modelo 7 da AGT (Caixa 2) acima para habilitar o confronto.
                </div>
              )}
            </div>
          </div>

          {/* ESTADO DE PROCESSAMENTO */}
          {executando && (
            <div className="row mb-25 no-print">
              <div className="col-12">
                <div
                  className="card card-default text-center py-50 d-flex flex-column align-items-center justify-content-center"
                  style={{ border: '1px solid #edf0f5', borderRadius: 12, minHeight: 220 }}
                >
                  <SpinDots />
                  <h5 className="fw-700 color-dark mt-20 mb-8" style={{ fontSize: 17 }}>
                    {etapaTexto || 'A confrontar Balancete com o Portal da AGT...'}
                  </h5>
                  <p className="text-muted mb-0" style={{ fontSize: 13.5, maxWidth: 650, margin: '0 auto', textAlign: 'center' }}>
                    O motor de inteligência artificial está a validar as contas do PGC, a cruzar com as 56 linhas do Modelo 7 e a apurar conformidades e divergências fiscais.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3: RELATÓRIO DO CONFRONTO GERADO */}
          {!executando && parsedData && (
            <div id="secao-relatorio-confronto">
              {/* CABEÇALHO TIMBRADO PARA IMPRESSÃO / PDF */}
              <div className="print-only mb-25 pb-15 border-bottom" style={{ borderBottom: '2px solid #1a3353' }}>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a3353', margin: 0, textTransform: 'uppercase' }}>
                      {empresaAtual?.nome || 'EMPRESA CONTRIBUINTE'}
                    </h2>
                    <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
                      <strong>NIF:</strong> {empresaAtual?.nif || '---'} &nbsp;|&nbsp; <strong>Regime IVA:</strong> {empresaAtual?.regime_iva || 'Geral'}
                    </div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                      {empresaAtual?.morada || 'República de Angola'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1a3353', letterSpacing: '0.5px' }}>
                      RELATÓRIO TÉCNICO DE CONFRONTO FISCAL
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                      Balancete PGC vs Modelo 7 AGT
                    </div>
                    <div style={{ fontSize: 11, color: '#333', marginTop: 2 }}>
                      Período: <strong>{String(mes).padStart(2, '0')}/{ano}</strong> &nbsp;|&nbsp; Emissão: {new Date().toLocaleDateString('pt-PT')}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 10, padding: '6px 12px', background: '#f4f6f9', fontSize: 10.5, color: '#444', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                  <strong>Enquadramento Legal:</strong> Plano Geral de Contabilidade (Decreto Presidencial n.º 82/01), Código do IVA (Lei n.º 7/19 de 24 de Abril) e Código Geral Tributário (Lei n.º 21/14).
                </div>
              </div>

              {/* BARRA DE AÇÕES DO RELATÓRIO NO ECRÃ */}
              <div className="card card-default mb-20 no-print" style={{ border: '1px solid #edf0f5', borderRadius: 10, background: '#f8fafc' }}>
                <div className="card-body py-15 px-20">
                  <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
                    <div>
                      <span className="badge badge-success mr-2" style={{ fontSize: 12 }}>
                        ✓ Passo 3 Concluído
                      </span>
                      <strong className="color-dark" style={{ fontSize: 14 }}>
                        Relatório de Confronto Gerado com Sucesso
                      </strong>
                    </div>

                    <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
                      {/* Tradução com IA */}
                      <div className="d-flex align-items-center bg-white p-1 rounded border shadow-xs" style={{ gap: 4 }}>
                        <span className="text-muted fw-600 px-2" style={{ fontSize: 12 }}>
                          <i className="la la-language text-primary mr-1"></i> Traduzir Relatório:
                        </span>
                        <button
                          type="button"
                          className={`btn btn-xs ${idiomaRelatorio === 'pt' ? 'btn-primary' : 'btn-light'}`}
                          onClick={() => handleTraduzirRelatorio('pt')}
                          disabled={traduzindo}
                          style={{ fontWeight: 700, borderRadius: 6, fontSize: 11.5, padding: '3px 8px' }}
                          title="Traduzir relatório para Português"
                        >
                          🇦🇴 PT
                        </button>
                        <button
                          type="button"
                          className={`btn btn-xs ${idiomaRelatorio === 'en' ? 'btn-primary' : 'btn-light'}`}
                          onClick={() => handleTraduzirRelatorio('en')}
                          disabled={traduzindo}
                          style={{ fontWeight: 700, borderRadius: 6, fontSize: 11.5, padding: '3px 8px' }}
                          title="Translate report to English"
                        >
                          🇬🇧 EN
                        </button>
                        <button
                          type="button"
                          className={`btn btn-xs ${idiomaRelatorio === 'zh' ? 'btn-primary' : 'btn-light'}`}
                          onClick={() => handleTraduzirRelatorio('zh')}
                          disabled={traduzindo}
                          style={{ fontWeight: 700, borderRadius: 6, fontSize: 11.5, padding: '3px 8px' }}
                          title="翻译报告为中文 (Chinese)"
                        >
                          🇨🇳 中文
                        </button>
                        {traduzindo && (
                          <span className="text-primary px-1" style={{ fontSize: 12 }}>
                            <i className="la la-spinner la-spin"></i>
                          </span>
                        )}
                      </div>

                      {/* Alternar Painel Visual vs Texto Pericial */}
                      <button
                        type="button"
                        className={`btn btn-sm ${visualizacaoTexto ? 'btn-info text-white' : 'btn-outline-info bg-white'}`}
                        onClick={() => setVisualizacaoTexto(!visualizacaoTexto)}
                        style={{ fontWeight: 700, padding: '7px 14px', fontSize: 12.5 }}
                        title="Alternar entre painel de cartões visuais e texto pericial completo"
                      >
                        <i className={`la ${visualizacaoTexto ? 'la-th-large' : 'la-file-alt'} mr-1`}></i>
                        {visualizacaoTexto ? 'Painel Visual' : 'Texto Completo'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={handleExportarExcel}
                        disabled={exportandoExcel}
                        style={{ fontWeight: 700, padding: '8px 16px', fontSize: 13 }}
                      >
                        <i className={`la ${exportandoExcel ? 'la-spinner la-spin' : 'la-file-excel'} mr-2`}></i>
                        {exportandoExcel ? 'A descarregar...' : 'Descarregar Excel (.xlsx)'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm bg-white"
                        onClick={handlePrint}
                        style={{ fontWeight: 700, padding: '8px 16px', fontSize: 13 }}
                      >
                        <i className="la la-print mr-2"></i> Imprimir / Salvar PDF
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-lighten btn-sm bg-white"
                        onClick={handleLimparNovoConfronto}
                        style={{ fontWeight: 600, padding: '8px 14px', fontSize: 13 }}
                      >
                        <i className="la la-sync mr-1"></i> Fazer Novo Confronto
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* MODO DE TEXTO PERICIAL COMPLETO */}
              {visualizacaoTexto && resultadoRaw && (
                <div className="card card-default mb-25" style={{ border: '1px solid #edf0f5', borderRadius: 10, background: '#ffffff' }}>
                  <div className="card-header py-12 px-20 bg-light border-bottom d-flex justify-content-between align-items-center">
                    <strong className="color-dark" style={{ fontSize: 14 }}>
                      <i className="la la-file-text text-primary mr-5"></i> Relatório Pericial Completo ({idiomaRelatorio === 'zh' ? '中文' : idiomaRelatorio === 'en' ? 'English' : 'Português'})
                    </strong>
                    <button
                      type="button"
                      className="btn btn-xs btn-outline-secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(resultadoRaw);
                        toast.info('Texto do relatório copiado para a área de transferência.');
                      }}
                    >
                      <i className="la la-copy mr-1"></i> Copiar Texto
                    </button>
                  </div>
                  <div className="card-body p-25" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 13.5, color: '#272b41', background: '#fdfdfe', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {resultadoRaw}
                  </div>
                </div>
              )}

              {/* 1. CARTÕES DE MÉTRICAS / KPIS */}
              <div className="row mb-20" style={{ rowGap: 12 }}>
                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="confronto-kpi-card h-100">
                    <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                      PONTOS CONFRONTADOS
                    </span>
                    <div className="fw-700 color-dark" style={{ fontSize: 24 }}>
                      {parsedData.totalPontos || parsedData.itensConfronto.length}{' '}
                      <span className="fs-13 text-muted fw-normal">rubricas fiscais</span>
                    </div>
                    <span className="text-muted" style={{ fontSize: 11.5 }}>
                      Balancete PGC vs Modelo 7
                    </span>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="confronto-kpi-card h-100">
                    <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                      DADOS EM CONFORMIDADE (IGUAIS)
                    </span>
                    <div className="fw-700 color-success" style={{ fontSize: 24 }}>
                      {parsedData.iguaisCount}{' '}
                      <span className="fs-13 text-muted fw-normal">pontos conformes</span>
                    </div>
                    <span className="text-success fw-600" style={{ fontSize: 11.5 }}>
                      <i className="la la-check-circle mr-1"></i> Valores 100% coincidentes
                    </span>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="confronto-kpi-card h-100">
                    <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                      DIVERGÊNCIAS APURADAS
                    </span>
                    <div
                      className={`fw-700 ${parsedData.diferencasCount > 0 ? 'color-danger' : 'color-success'}`}
                      style={{ fontSize: 24 }}
                    >
                      {parsedData.diferencasCount}{' '}
                      <span className="fs-13 text-muted fw-normal">diferenças</span>
                    </div>
                    <span className={parsedData.diferencasCount > 0 ? 'text-danger fw-600' : 'text-success'} style={{ fontSize: 11.5 }}>
                      {parsedData.diferencasCount > 0 ? '⚠️ Requer regularização prévia' : 'Nenhuma divergência apurada'}
                    </span>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-lg-3">
                  <div className="confronto-kpi-card h-100">
                    <span className="text-muted fw-600 d-block mb-4" style={{ fontSize: 11.5, textTransform: 'uppercase' }}>
                      DIAGNÓSTICO GERAL DE RISCO
                    </span>
                    <div
                      className={`fw-700 ${parsedData.diferencasCount > 0 ? 'color-warning' : 'color-success'}`}
                      style={{ fontSize: 18 }}
                    >
                      {parsedData.diferencasCount > 0 ? 'ATENÇÃO REQUERIDA' : 'CONFORME'}
                    </div>
                    <span className="text-muted" style={{ fontSize: 11.5 }}>
                      Segundo Código do IVA e CGT
                    </span>
                  </div>
                </div>
              </div>

              {/* QUADRO DE DESTAQUE: APURAMENTO DO IVA (LEI N.º 7/19 - CIVA) */}
              <div className="card card-default mb-25" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ background: '#ffffff', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
                  <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 12 }}>
                    <div>
                      <div className="d-flex align-items-center" style={{ gap: 10 }}>
                        <i className="la la-balance-scale text-primary" style={{ fontSize: 22 }}></i>
                        <strong className="color-dark" style={{ fontSize: 14.5, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#0f172a' }}>
                          Quadro Oficial de Apuramento do IVA (CIVA — Lei n.º 7/19)
                        </strong>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        Fórmula Legal Obrigatória: <strong>Apuramento = IVA Liquidado (Vendas) − IVA Dedutível (Compras)</strong>
                      </div>
                    </div>
                    <span className="badge" style={{ fontSize: 11, padding: '7px 14px', fontWeight: 600, border: '1px solid #e2e8f0', color: '#475569', background: '#f8fafc', borderRadius: '6px' }}>
                      Artigos 19.º e seguintes do CIVA
                    </span>
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '24px' }}>
                  <div className="row" style={{ rowGap: 24 }}>
                    {/* 1. VENDAS OU SERVIÇOS (INCIDÊNCIA + IVA LIQUIDADO) */}
                    <div className="col-12 col-md-4 d-flex flex-column">
                      <div style={{ textAlign: 'center', marginBottom: '14px', paddingTop: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', letterSpacing: '0.6px', textTransform: 'uppercase', display: 'inline-block' }}>
                          (VENDAS OU SERVIÇOS)
                        </span>
                      </div>
                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '20px 18px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px'
                      }}>
                        <div>
                          {/* SUB-BLOCO A: INCIDÊNCIA DE VENDAS */}
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                            <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                Incidência (Base de Vendas)
                              </span>
                              <span className="badge" style={{ fontSize: '9.5px', background: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', fontWeight: 600, padding: '3px 6px' }}>
                                Conta 61 vs Campo 1/1.2
                              </span>
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', marginBottom: '1px' }}>Contabilidade (Balancete Conta 61):</span>
                              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f172a' }}>
                                {parsedData.apuramentoIva?.incidenciaVendas?.contabilidade || '—'}
                              </div>
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', marginBottom: '1px' }}>Modelo 7 (Quadro 09 - Campos 1 e 1.2):</span>
                              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f172a' }}>
                                {parsedData.apuramentoIva?.incidenciaVendas?.agt || '—'}
                              </div>
                            </div>
                            <div style={{ paddingTop: '6px', borderTop: '1px dashed #cbd5e1', display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '10.5px', color: '#64748b' }}>Diferença na Base:</span>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: parsedData.apuramentoIva?.incidenciaVendas?.status === 'IGUAIS' ? '#16a34a' : '#dc2626' }}>
                                {parsedData.apuramentoIva?.incidenciaVendas?.status === 'IGUAIS' ? '✓ Conforme (0,00 Kz)' : parsedData.apuramentoIva?.incidenciaVendas?.diferenca}
                              </span>
                            </div>
                          </div>

                          {/* SUB-BLOCO B: IVA LIQUIDADO GERADO */}
                          <div style={{ padding: '0 2px' }}>
                            <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '10px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                                (+) 1. IVA Liquidado (14%)
                              </span>
                              <span className="badge" style={{ fontSize: '10px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 600, padding: '4px 8px' }}>
                                Conta 34.5.3 · Campo 33
                              </span>
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Contabilidade (Conta 34.5.3):</span>
                              <div style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                                {parsedData.apuramentoIva?.liquidado.contabilidade || '—'}
                              </div>
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Declaração AGT (Campo 33):</span>
                              <div style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                                {parsedData.apuramentoIva?.liquidado.agt || '—'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>Diferença no IVA:</span>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, color: parsedData.apuramentoIva?.liquidado.status === 'IGUAIS' ? '#16a34a' : '#dc2626' }}>
                            {parsedData.apuramentoIva?.liquidado.diferenca || '0,00 Kz'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. COMPRAS OU DESPESAS (INCIDÊNCIA DE COMPRAS + IVA DEDUTÍVEL) */}
                    <div className="col-12 col-md-4 d-flex flex-column">
                      <div style={{ textAlign: 'center', marginBottom: '14px', paddingTop: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b', letterSpacing: '0.6px', textTransform: 'uppercase', display: 'inline-block' }}>
                          (COMPRAS OU DESPESAS)
                        </span>
                      </div>
                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '20px 18px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px'
                      }}>
                        <div>
                          {/* SUB-BLOCO A: INCIDÊNCIA DE COMPRAS E SERVIÇOS */}
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                            <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                Incidência (Compras e FSE)
                              </span>
                              <span className="badge" style={{ fontSize: '9.5px', background: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', fontWeight: 600, padding: '3px 6px' }}>
                                Conta 21/752 vs Campo 22
                              </span>
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', marginBottom: '1px' }}>Contabilidade (Balancete Conta 21):</span>
                              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f172a' }}>
                                {parsedData.apuramentoIva?.incidenciaCompras?.contabilidade || '—'}
                              </div>
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block', marginBottom: '1px' }}>Modelo 7 (Quadro 09 - Campo 22):</span>
                              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f172a' }}>
                                {parsedData.apuramentoIva?.incidenciaCompras?.agt || '—'}
                              </div>
                            </div>
                            <div style={{ paddingTop: '6px', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '10.5px', color: '#64748b' }}>Diferença nas Compras:</span>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: parsedData.apuramentoIva?.incidenciaCompras?.status === 'IGUAIS' ? '#16a34a' : '#dc2626' }}>
                                {parsedData.apuramentoIva?.incidenciaCompras?.status === 'IGUAIS' ? '✓ Conforme (0,00 Kz)' : parsedData.apuramentoIva?.incidenciaCompras?.diferenca}
                              </span>
                            </div>
                          </div>

                          {/* SUB-BLOCO B: IVA DEDUTÍVEL */}
                          <div style={{ padding: '0 2px' }}>
                            <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '10px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                                (−) 2. IVA Dedutível
                              </span>
                              <span className="badge" style={{ fontSize: '10px', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 600, padding: '4px 8px' }}>
                                Conta 34.5.1/2 · Campo 32
                              </span>
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Contabilidade (Conta 34.5.1/34.5.2):</span>
                              <div style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                                {parsedData.apuramentoIva?.dedutivel.contabilidade || '—'}
                              </div>
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Declaração AGT (Campo 32):</span>
                              <div style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                                {parsedData.apuramentoIva?.dedutivel.agt || '—'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>Diferença no IVA:</span>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, color: parsedData.apuramentoIva?.dedutivel.status === 'IGUAIS' ? '#16a34a' : '#dc2626' }}>
                            {parsedData.apuramentoIva?.dedutivel.diferenca || '0,00 Kz'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. APURAMENTO DO IVA (AMBOS OS DOCUMENTOS + CONFRONTO DIRETO) */}
                    <div className="col-12 col-md-4 d-flex flex-column">
                      <div style={{ textAlign: 'center', marginBottom: '14px', paddingTop: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.6px', textTransform: 'uppercase', display: 'inline-block' }}>
                          APURAMENTO DO IVA
                        </span>
                      </div>
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderTop: `4px solid ${parsedData.apuramentoIva?.isRecuperar ? '#10b981' : parsedData.apuramentoIva?.isReembolso ? '#3b82f6' : '#ef4444'}`,
                          borderRadius: '10px',
                          padding: '20px 18px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '14px'
                        }}
                      >
                        <div>
                          {/* HEADER SITUAÇÃO APURAMENTO */}
                          <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '12px' }}>
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: 800,
                                color: '#0f172a',
                                letterSpacing: '0.3px',
                                textTransform: 'uppercase'
                              }}
                            >
                              {parsedData.apuramentoIva?.tituloCard3 || '(=) 3. Apuramento do IVA'}
                            </span>
                            <span
                              className="badge"
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                background: parsedData.apuramentoIva?.isRecuperar ? '#ecfdf5' : parsedData.apuramentoIva?.isReembolso ? '#eff6ff' : '#fef2f2',
                                color: parsedData.apuramentoIva?.isRecuperar ? '#047857' : parsedData.apuramentoIva?.isReembolso ? '#1d4ed8' : '#b91c1c',
                                border: `1px solid ${parsedData.apuramentoIva?.isRecuperar ? '#a7f3d0' : parsedData.apuramentoIva?.isReembolso ? '#bfdbfe' : '#fecaca'}`,
                                padding: '4px 8px'
                              }}
                            >
                              {parsedData.apuramentoIva?.rubricaCard3 || 'Conta 34.5'}
                            </span>
                          </div>

                          {/* APURAMENTO DOCUMENTO 1: CONTABILIDADE (BALANCETE) */}
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
                            <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '4px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                                1. Contabilidade (Balancete)
                              </span>
                              <span className="badge" style={{ fontSize: '9px', background: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', padding: '2px 5px' }}>
                                {parsedData.apuramentoIva?.apuramentoContabilidade?.conta || 'Conta 34.5'}
                              </span>
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: parsedData.apuramentoIva?.isRecuperar ? '#047857' : '#b91c1c', marginBottom: '2px' }}>
                              {parsedData.apuramentoIva?.apuramentoContabilidade?.saldo || parsedData.apuramentoIva?.resultadoPrincipal?.contabilidade || '—'}
                            </div>
                            <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>
                              {parsedData.apuramentoIva?.apuramentoContabilidade?.rubrica || (parsedData.apuramentoIva?.isRecuperar ? 'IVA a Recuperar' : 'IVA a Pagar')} · (Liq − Ded)
                            </span>
                          </div>

                          {/* APURAMENTO DOCUMENTO 2: AGT (MODELO 7) */}
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                            <div className="d-flex justify-content-between align-items-center" style={{ marginBottom: '4px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                                2. Declaração AGT (Modelo 7)
                              </span>
                              <span className="badge" style={{ fontSize: '9px', background: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', padding: '2px 5px' }}>
                                {parsedData.apuramentoIva?.apuramentoAgt?.campo || 'Quadro 10'}
                              </span>
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: parsedData.apuramentoIva?.isRecuperar ? '#047857' : '#b91c1c', marginBottom: '2px' }}>
                              {parsedData.apuramentoIva?.apuramentoAgt?.saldoPeriodo || parsedData.apuramentoIva?.resultadoPrincipal?.agt || '—'}
                            </div>
                            {parsedData.apuramentoIva?.apuramentoAgt?.excessoAnterior && (
                              <div style={{ fontSize: '10.5px', color: '#475569', marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed #cbd5e1' }}>
                                <div>(+) Excesso Período Anterior (C.36): <strong>{parsedData.apuramentoIva.apuramentoAgt.excessoAnterior}</strong></div>
                                <div>(=) Posição Final Acumulada (C.39): <strong style={{ color: '#047857' }}>{parsedData.apuramentoIva.apuramentoAgt.posicaoFinal}</strong></div>
                              </div>
                            )}
                          </div>

                          {/* AVISO LEGAL/CONTABILÍSTICO SÓBRIO E ELEGANTE COM PADDING ADEQUADO */}
                          <div style={{ background: '#ffffff', border: `1px solid ${parsedData.apuramentoIva?.isRecuperar ? '#a7f3d0' : '#fecaca'}`, borderRadius: '8px', padding: '10px 12px', fontSize: '11px', color: '#334155', lineHeight: 1.5 }}>
                            {parsedData.apuramentoIva?.isRecuperar ? (
                              <>
                                <strong style={{ color: '#047857' }}>✓ A empresa NÃO PAGA IVA neste período:</strong> O imposto dedutível supera o liquidado. O crédito apurado <strong>acumula e transita como crédito fiscal para o mês seguinte</strong> (Artigo 19.º do CIVA).
                              </>
                            ) : parsedData.apuramentoIva?.isReembolso ? (
                              <>
                                <strong style={{ color: '#1d4ed8' }}>ℹ️ Reembolso (Parcial ou Total):</strong> Pedido de devolução de crédito tributário submetido à AGT nos termos do regulamento do CIVA.
                              </>
                            ) : (
                              <>
                                <strong style={{ color: '#b91c1c' }}>⚠️ Imposto a pagar ao Estado:</strong> Valor apurado a liquidar perante a AGT através de DAR até ao último dia do mês legalmente fixado.
                              </>
                            )}
                          </div>
                        </div>

                        {/* CONFRONTO DIRETO DO APURAMENTO */}
                        <div style={{ paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>Confronto do Período:</span>
                          <span
                            className="badge"
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              background: parsedData.apuramentoIva?.confrontoPeriodo?.status === 'IGUAIS' ? '#ecfdf5' : '#fef2f2',
                              color: parsedData.apuramentoIva?.confrontoPeriodo?.status === 'IGUAIS' ? '#047857' : '#b91c1c',
                              border: `1px solid ${parsedData.apuramentoIva?.confrontoPeriodo?.status === 'IGUAIS' ? '#a7f3d0' : '#fecaca'}`,
                              padding: '6px 12px'
                            }}
                          >
                            {parsedData.apuramentoIva?.confrontoPeriodo?.status === 'IGUAIS' ? '✓ IGUAIS (CONFORME)' : `⚠️ DIFERENÇA: ${parsedData.apuramentoIva?.confrontoPeriodo?.diferenca}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* OS TRÊS RESULTADOS OFICIAIS DO APURAMENTO DO IVA (PGC ANGOLANO · CONTAS 34.5) - SÓBRIO E CONFORME */}
                  <div style={{ marginTop: '32px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '22px 22px' }}>
                    <div className="d-flex justify-content-between align-items-center mb-15 flex-wrap" style={{ gap: 10 }}>
                      <span className="fw-700 text-uppercase" style={{ fontSize: 12, color: '#334155', letterSpacing: '0.4px' }}>
                        <i className="la la-book-open text-primary mr-1" style={{ fontSize: 15 }}></i>
                        Quadro Regulamentar: Os Três Resultados Oficiais do Apuramento (PGC Angolano · Contas 34.5)
                      </span>
                      <span className="badge" style={{ fontSize: 10.5, background: '#ffffff', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: 600, padding: '5px 10px' }}>
                        Art. 19.º CIVA · Lei n.º 7/19
                      </span>
                    </div>

                    <div className="row" style={{ rowGap: 14 }}>
                      {/* Conta 34.5.6.1 */}
                      <div className="col-12 col-md-4">
                        <div
                          style={{
                            background: '#ffffff',
                            border: `1px solid ${parsedData.apuramentoIva?.tipoApuramento === 'PAGAR' ? '#fecaca' : '#e2e8f0'}`,
                            borderLeft: `4px solid ${parsedData.apuramentoIva?.tipoApuramento === 'PAGAR' ? '#ef4444' : '#cbd5e1'}`,
                            borderRadius: '8px',
                            padding: '16px 18px',
                            height: '100%'
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center mb-8">
                            <strong style={{ fontSize: 12, color: parsedData.apuramentoIva?.tipoApuramento === 'PAGAR' ? '#b91c1c' : '#475569' }}>
                              Conta 34.5.6.1
                            </strong>
                            {parsedData.apuramentoIva?.tipoApuramento === 'PAGAR' ? (
                              <span className="badge" style={{ fontSize: 9.5, fontWeight: 700, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '3px 8px' }}>
                                SITUAÇÃO ATIVA
                              </span>
                            ) : (
                              <span className="text-muted" style={{ fontSize: 10.5 }}>Inativa · Campo 37 AGT</span>
                            )}
                          </div>
                          <div className="fw-700 mb-6" style={{ fontSize: 12, color: '#0f172a' }}>
                            IVA a Pagar de Apuramento
                          </div>
                          <div className="text-muted" style={{ fontSize: 11, lineHeight: 1.45 }}>
                            Aplica-se quando <strong>Liquidado &gt; Dedutível</strong>. Imposto exigível pelo Estado a entregar via DAR.
                          </div>
                        </div>
                      </div>

                      {/* Conta 34.5.7.1 */}
                      <div className="col-12 col-md-4">
                        <div
                          style={{
                            background: '#ffffff',
                            border: `1px solid ${parsedData.apuramentoIva?.tipoApuramento === 'RECUPERAR' ? '#a7f3d0' : '#e2e8f0'}`,
                            borderLeft: `4px solid ${parsedData.apuramentoIva?.tipoApuramento === 'RECUPERAR' ? '#10b981' : '#cbd5e1'}`,
                            borderRadius: '8px',
                            padding: '16px 18px',
                            height: '100%'
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center mb-8">
                            <strong style={{ fontSize: 12, color: parsedData.apuramentoIva?.tipoApuramento === 'RECUPERAR' ? '#047857' : '#475569' }}>
                              Conta 34.5.7.1
                            </strong>
                            {parsedData.apuramentoIva?.tipoApuramento === 'RECUPERAR' ? (
                              <span className="badge" style={{ fontSize: 9.5, fontWeight: 700, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '3px 8px' }}>
                                SITUAÇÃO ATIVA
                              </span>
                            ) : (
                              <span className="text-muted" style={{ fontSize: 10.5 }}>Inativa · Campo 34/39 AGT</span>
                            )}
                          </div>
                          <div className="fw-700 mb-6" style={{ fontSize: 12, color: '#0f172a' }}>
                            IVA a Recuperar de Apuramentos
                          </div>
                          <div className="text-muted" style={{ fontSize: 11, lineHeight: 1.45 }}>
                            Aplica-se quando <strong>Dedutível &gt; Liquidado</strong>. A empresa <strong>não paga IVA</strong>; o crédito <strong>acumula para o mês seguinte</strong>.
                          </div>
                        </div>
                      </div>

                      {/* Conta 34.5.8.1 */}
                      <div className="col-12 col-md-4">
                        <div
                          style={{
                            background: '#ffffff',
                            border: `1px solid ${parsedData.apuramentoIva?.tipoApuramento === 'REEMBOLSO' ? '#bfdbfe' : '#e2e8f0'}`,
                            borderLeft: `4px solid ${parsedData.apuramentoIva?.tipoApuramento === 'REEMBOLSO' ? '#3b82f6' : '#cbd5e1'}`,
                            borderRadius: '8px',
                            padding: '16px 18px',
                            height: '100%'
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center mb-8">
                            <strong style={{ fontSize: 12, color: parsedData.apuramentoIva?.tipoApuramento === 'REEMBOLSO' ? '#1d4ed8' : '#475569' }}>
                              Conta 34.5.8.1
                            </strong>
                            {parsedData.apuramentoIva?.tipoApuramento === 'REEMBOLSO' ? (
                              <span className="badge" style={{ fontSize: 9.5, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 8px' }}>
                                SITUAÇÃO ATIVA
                              </span>
                            ) : (
                              <span className="text-muted" style={{ fontSize: 10.5 }}>Inativa · Campo 40 AGT</span>
                            )}
                          </div>
                          <div className="fw-700 mb-6" style={{ fontSize: 12, color: '#0f172a' }}>
                            IVA Reembolsos Pedidos
                          </div>
                          <div className="text-muted" style={{ fontSize: 11, lineHeight: 1.45 }}>
                            <strong>Reembolso (Parcial ou Total)</strong> solicitado formalmente à AGT para restituição de saldo credor.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '8px', background: '#f8fafc', fontSize: '11.5px', color: '#475569', border: '1px solid #edf0f5', lineHeight: 1.55 }}>
                    <i className="la la-info-circle text-primary mr-1" style={{ fontSize: 13 }}></i>
                    <strong>Regra Oficial do CIVA (Lei n.º 7/19):</strong> O apuramento do IVA resulta do confronto entre o imposto liquidado nas vendas ou prestações de serviços (Conta 34.5.3) e o imposto dedutível suportado nas compras ou despesas (Conta 34.5.1/34.5.2). Se o imposto liquidado for superior, apura-se imposto a pagar ao Estado (Conta 34.5.6.1). Se o imposto dedutível for superior, a empresa não paga IVA, transitando o saldo como crédito fiscal para dedução nos períodos seguintes (Conta 34.5.7.1) ou solicitando reembolso (Conta 34.5.8.1).
                  </div>
                </div>
              </div>

              {/* 2. TABELA COMPARATIVA DE CONFRONTO */}
              <div className="row mb-25">
                <div className="col-12">
                  <div className="card card-default" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
                    <div className="card-header py-12 px-20 bg-light border-bottom">
                      <strong className="color-dark" style={{ fontSize: 14 }}>
                        <i className="la la-table text-primary mr-5"></i> 2. Detalhe dos Dados Confrontados: Balancete vs Portal AGT
                      </strong>
                    </div>

                    <div className="card-body p-0">
                      <div className="table-responsive">
                        <table className="table table-hover mb-0" style={{ fontSize: 13 }}>
                          <thead style={{ backgroundColor: '#f9fafb' }}>
                            <tr>
                              <th style={{ width: '34%', fontWeight: 700, color: '#495057' }}>
                                Ponto de Confronto / Rubrica Fiscal
                              </th>
                              <th style={{ width: '22%', fontWeight: 700, color: '#495057', textAlign: 'right' }}>
                                Contabilidade (Balancete PGC)
                              </th>
                              <th style={{ width: '22%', fontWeight: 700, color: '#495057', textAlign: 'right' }}>
                                Declaração AGT (Modelo 7)
                              </th>
                              <th style={{ width: '11%', fontWeight: 700, color: '#495057', textAlign: 'center' }}>
                                Status
                              </th>
                              <th style={{ width: '11%', fontWeight: 700, color: '#495057', textAlign: 'right' }}>
                                Diferença
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {parsedData.itensConfronto.map((item, idx) => {
                              const isOk = item.status === 'IGUAIS' || item.status === 'OK' || item.status === 'CONFORME';
                              return (
                                <tr key={idx}>
                                  <td style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                                    {item.campo}
                                  </td>
                                  <td style={{ verticalAlign: 'middle', color: '#272b41', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {item.contabilidade}
                                  </td>
                                  <td style={{ verticalAlign: 'middle', color: '#272b41', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {item.agt}
                                  </td>
                                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                    <span className={isOk ? 'status-badge-conforme' : 'status-badge-divergencia'}>
                                      <i className={isOk ? 'la la-check' : 'la la-exclamation-triangle'}></i>
                                      {isOk ? 'IGUAIS' : 'DIFERENÇA'}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right', verticalAlign: 'middle', fontWeight: 700, color: isOk ? '#00a854' : '#f5222d', whiteSpace: 'nowrap' }}>
                                    {item.diferenca}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. ANÁLISE TÉCNICA DAS DIFERENÇAS E RECOMENDAÇÕES */}
              <div className="row mb-25">
                <div className="col-12 col-lg-7">
                  <div className="card card-default h-100" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
                    <div className="card-header py-12 px-20 bg-light border-bottom">
                      <strong className="color-dark" style={{ fontSize: 14 }}>
                        <i className="la la-stethoscope text-primary mr-5"></i> 3. Diagnóstico Técnico & Riscos Fiscais
                      </strong>
                    </div>

                    <div className="card-body p-20">
                      {parsedData.diferencasDetalhadas.length > 0 ? (
                        parsedData.diferencasDetalhadas.map((dif, index) => (
                          <div key={index} className="diff-box">
                            <strong className="color-danger d-block mb-2" style={{ fontSize: 14 }}>
                              <i className="la la-exclamation-circle mr-1"></i> {dif.titulo}
                            </strong>
                            {dif.balancete && (
                              <div style={{ fontSize: 12.5 }} className="mb-1 text-muted">
                                <strong>Balancete:</strong> {dif.balancete}
                              </div>
                            )}
                            {dif.agt && (
                              <div style={{ fontSize: 12.5 }} className="mb-2 text-muted">
                                <strong>Modelo 7 AGT:</strong> {dif.agt}
                              </div>
                            )}
                            {dif.causas && dif.causas.length > 0 && (
                              <div style={{ fontSize: 12.5 }} className="mb-2">
                                <span className="fw-600 text-dark">Causa Provável:</span>{' '}
                                <span className="text-muted">{dif.causas.join(' ')}</span>
                              </div>
                            )}
                            {dif.riscos && dif.riscos.length > 0 && (
                              <div style={{ fontSize: 12.5 }} className="text-danger fw-600">
                                <span>Risco Fiscal:</span> {dif.riscos.join(' ')}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="diff-box-ok">
                          <strong className="text-success d-block mb-1">
                            <i className="la la-check-circle mr-1"></i> Sem divergências críticas detetadas
                          </strong>
                          <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                            Os valores declarados no Modelo 7 coincidem com os registos apurados no Balancete de Verificação.
                          </p>
                        </div>
                      )}

                      {/* Pontos Conformes */}
                      {parsedData.pontosIguais.length > 0 && (
                        <div className="mt-15 pt-15 border-top">
                          <span className="fw-700 color-dark d-block mb-8" style={{ fontSize: 13 }}>
                            <i className="la la-check-circle text-success mr-4"></i> Pontos em Perfeita Conformidade:
                          </span>
                          <ul className="mb-0 pl-15" style={{ fontSize: 12.5 }}>
                            {parsedData.pontosIguais.map((pt, pIdx) => (
                              <li key={pIdx} className="text-muted mb-4">
                                {pt}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-5">
                  <div className="card card-default h-100" style={{ border: '1px solid #edf0f5', borderRadius: 10 }}>
                    <div className="card-header py-12 px-20 bg-light border-bottom">
                      <strong className="color-dark" style={{ fontSize: 14 }}>
                        <i className="la la-tasks text-primary mr-5"></i> 4. O que Fazer para Resolver (Recomendações)
                      </strong>
                    </div>

                    <div className="card-body p-20">
                      {parsedData.recomendacoes && parsedData.recomendacoes.length > 0 ? (
                        parsedData.recomendacoes.map((rec, rIdx) => (
                          <div key={rIdx} className="rec-item-card">
                            <div className="rec-badge-number">{rec.numero || rIdx + 1}</div>
                            <div style={{ minWidth: 0 }}>
                              <strong className="color-dark d-block mb-1" style={{ fontSize: 13 }}>
                                {rec.titulo}
                              </strong>
                              {rec.detalhes && rec.detalhes.length > 0 && (
                                <p className="text-muted mb-0" style={{ fontSize: 12 }}>
                                  {rec.detalhes.join(' ')}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-20 text-muted" style={{ fontSize: 13 }}>
                          Nenhuma ação corretiva adicional necessária para este período.
                        </div>
                      )}

                      {/* Resultado Esperado */}
                      {parsedData.resultadoEsperado && parsedData.resultadoEsperado.length > 0 && (
                        <div className="mt-15 p-12 bg-light rounded" style={{ border: '1px solid #e2e8f0' }}>
                          <span className="fw-700 color-primary d-block mb-4" style={{ fontSize: 12 }}>
                            <i className="la la-bullseye mr-3"></i> RESULTADO ESPERADO
                          </span>
                          <p className="text-muted mb-0" style={{ fontSize: 12 }}>
                            {parsedData.resultadoEsperado.join(' ')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOCO DE ASSINATURAS OFICIAIS (IMPRESSÃO / PDF) */}
              <div className="print-only mt-40 pt-20" style={{ pageBreakInside: 'avoid', borderTop: '1px solid #cbd5e1' }}>
                <div className="row" style={{ marginTop: 20 }}>
                  <div className="col-6 text-center">
                    <div style={{ borderTop: '1px solid #1a3353', width: '85%', margin: '0 auto', paddingTop: 8 }}>
                      <strong style={{ fontSize: 12, display: 'block', color: '#1a3353' }}>
                        O CONTABILISTA CERTIFICADO
                      </strong>
                      <span style={{ fontSize: 10.5, color: '#555', display: 'block' }}>
                        Ordem dos Contabilistas e Peritos Contabilistas de Angola (OCPCA)
                      </span>
                      <span style={{ fontSize: 10, color: '#777', display: 'block', marginTop: 4 }}>
                        Cédula Profissional N.º: ___________________________
                      </span>
                    </div>
                  </div>

                  <div className="col-6 text-center">
                    <div style={{ borderTop: '1px solid #1a3353', width: '85%', margin: '0 auto', paddingTop: 8 }}>
                      <strong style={{ fontSize: 12, display: 'block', color: '#1a3353' }}>
                        A GERÊNCIA / CONSELHO DE ADMINISTRAÇÃO
                      </strong>
                      <span style={{ fontSize: 10.5, color: '#555', display: 'block' }}>
                        {empresaAtual?.nome || 'A Empresa Contribuinte'}
                      </span>
                      <span style={{ fontSize: 10, color: '#777', display: 'block', marginTop: 4 }}>
                        (Assinatura e Carimbo Oficial)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-center mt-30" style={{ fontSize: 9.5, color: '#888' }}>
                  Documento emitido eletronicamente pela Plataforma de Reconciliação Contabilística & Fiscal de Angola — Cópia autêntica para integração no Dossier Fiscal da Empresa.
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default ConfrontoView;
