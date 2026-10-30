import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { lancamentoService, empresaService, pgcService } from '../../services/api';
import { usePeriodo } from '../../context/PeriodoContext';
import { kzComMoeda } from '../../utils/formato';

const TIPOS_DIARIO = [
  { valor: 'GERAL', labelKey: 'lancamentosUi.journalGeneral', label: 'Diário Geral' },
  { valor: 'COMPRAS', labelKey: 'lancamentosUi.journalPurchases', label: 'Diário de Compras e Fornecedores' },
  { valor: 'VENDAS', labelKey: 'lancamentosUi.journalSales', label: 'Diário de Vendas e Clientes' },
  { valor: 'BANCOS', labelKey: 'lancamentosUi.journalBanks', label: 'Diário de Movimentos Bancários' },
  { valor: 'CAIXA', labelKey: 'lancamentosUi.journalCash', label: 'Diário de Caixa' },
  { valor: 'OPERACOES_DIVERSAS', labelKey: 'lancamentosUi.journalMisc', label: 'Operações Diversas' },
  { valor: 'APURAMENTO_IVA', labelKey: 'lancamentosUi.journalVatSettlement', label: 'Apuramento de IVA' },
  { valor: 'FECHO_EXERCICIO', labelKey: 'lancamentosUi.journalClosing', label: 'Fecho do Exercício' },
];

const LancamentosView = ({ defaultAba }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { empresaId, ano, mes, atualizar } = usePeriodo();

  const getTipoDiarioLabel = (valor) => {
    const item = TIPOS_DIARIO.find((td) => td.valor === valor);
    return item ? t(item.labelKey, item.label) : valor;
  };

  // Determinar aba inicial a partir de defaultAba, pathname ou query params
  const getInitialAba = () => {
    if (defaultAba) return defaultAba;
    if (location.pathname === '/razao') return 'razao';
    if (location.pathname === '/balancete') return 'balancete_gerado';
    if (location.pathname === '/diario') return 'diario';
    const params = new URLSearchParams(location.search);
    const abaParam = params.get('aba');
    if (abaParam === 'razao') return 'razao';
    if (abaParam === 'balancete' || abaParam === 'balancete_gerado') return 'balancete_gerado';
    return 'diario';
  };

  const [abaAtiva, setAbaAtiva] = useState(getInitialAba); // 'diario', 'razao', 'balancete_gerado'

  // Sincronizar quando muda a rota
  useEffect(() => {
    if (defaultAba) {
      setAbaAtiva(defaultAba);
    } else if (location.pathname === '/razao') {
      setAbaAtiva('razao');
    } else if (location.pathname === '/balancete') {
      setAbaAtiva('balancete_gerado');
    } else if (location.pathname === '/diario') {
      setAbaAtiva('diario');
    }
  }, [defaultAba, location.pathname]);

  const [empresas, setEmpresas] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [contasPgc, setContasPgc] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Filtros de Diário
  const [filtroTipoDiario, setFiltroTipoDiario] = useState('TODOS');
  const [pesquisaDiario, setPesquisaDiario] = useState('');
  const [lancamentoExpandido, setLancamentoExpandido] = useState(null);

  // Modal de Novo/Editar Lançamento
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [edicaoId, setEdicaoId] = useState(null);
  const [formLancamento, setFormLancamento] = useState({
    data_lancamento: new Date().toISOString().split('T')[0],
    tipo_diario: 'GERAL',
    descricao: '',
    documento_referencia: '',
    linhas: [
      { ordem: 1, conta_codigo: '', conta_nome: '', debito: '', credito: '', descricao_linha: '', terceiro_nome: '', terceiro_nif: '' },
      { ordem: 2, conta_codigo: '', conta_nome: '', debito: '', credito: '', descricao_linha: '', terceiro_nome: '', terceiro_nif: '' },
    ],
  });

  // Estados do Livro Razão
  const [razaoContaFiltro, setRazaoContaFiltro] = useState('');
  const [razaoDados, setRazaoDados] = useState({ contas: [], total_contas_movimentadas: 0 });
  const [carregandoRazao, setCarregandoRazao] = useState(false);

  // Estados do Balancete Gerado
  const [balanceteDados, setBalanceteDados] = useState(null);
  const [carregandoBalancete, setCarregandoBalancete] = useState(false);

  // Carregar lista de empresas e contas do PGC
  useEffect(() => {
    empresaService.getAll().then((res) => {
      const lista = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setEmpresas(lista);
      if (lista.length > 0 && !empresaId) {
        atualizar({ empresaId: String(lista[0].id) });
      }
    }).catch(() => {});

    pgcService.getPgc().then((res) => {
      setContasPgc(res.data?.contas || []);
    }).catch(() => {});
  }, []);

  // Carregar dados de acordo com a aba e filtros
  const carregarDados = async () => {
    if (!empresaId) return;
    setCarregando(true);
    try {
      if (abaAtiva === 'diario') {
        const params = { empresa_id: empresaId, ano: ano || 2026, mes: mes || 7 };
        if (filtroTipoDiario !== 'TODOS') params.tipo_diario = filtroTipoDiario;
        if (pesquisaDiario.trim()) params.pesquisa = pesquisaDiario.trim();
        const res = await lancamentoService.getAll(params);
        setLancamentos(Array.isArray(res.data) ? res.data : []);
      } else if (abaAtiva === 'razao') {
        setCarregandoRazao(true);
        const params = { empresa_id: empresaId, ano: ano || 2026, mes: mes || 7 };
        if (razaoContaFiltro.trim()) params.conta_codigo = razaoContaFiltro.trim();
        const res = await lancamentoService.getRazao(params);
        setRazaoDados(res.data || { contas: [] });
      } else if (abaAtiva === 'balancete_gerado') {
        setCarregandoBalancete(true);
        const params = { empresa_id: empresaId, ano: ano || 2026, mes: mes || 7 };
        const res = await lancamentoService.getBalanceteGerado(params);
        setBalanceteDados(res.data);
      }
    } catch {
      toast.error(t('lancamentosUi.loadError', 'Erro ao carregar dados da contabilidade.'));
    } finally {
      setCarregando(false);
      setCarregandoRazao(false);
      setCarregandoBalancete(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [empresaId, ano, mes, abaAtiva, filtroTipoDiario]);

  // Cálculos de totais no formulário de Lançamento
  const totaisForm = useMemo(() => {
    let debito = 0;
    let credito = 0;
    (formLancamento.linhas || []).forEach((l) => {
      const d = parseFloat(String(l.debito || 0).replace(',', '.')) || 0;
      const c = parseFloat(String(l.credito || 0).replace(',', '.')) || 0;
      debito += d;
      credito += c;
    });
    const diferenca = Math.abs(debito - credito);
    const balanceado = diferenca < 0.009 && debito > 0;
    return {
      debito: debito.toFixed(2),
      credito: credito.toFixed(2),
      diferenca: diferenca.toFixed(2),
      balanceado,
    };
  }, [formLancamento.linhas]);

  // Abrir Modal de Novo Lançamento
  const abrirModalNovo = (template = null) => {
    setEdicaoId(null);
    let linhasIniciais = [
      { ordem: 1, conta_codigo: '', conta_nome: '', debito: '', credito: '', descricao_linha: '', terceiro_nome: '', terceiro_nif: '' },
      { ordem: 2, conta_codigo: '', conta_nome: '', debito: '', credito: '', descricao_linha: '', terceiro_nome: '', terceiro_nif: '' },
    ];
    let descInicial = '';
    let tipoInicial = 'GERAL';

    if (template === 'compra_iva') {
      tipoInicial = 'COMPRAS';
      descInicial = t('lancamentosUi.tplPurchaseDesc', 'Aquisição de mercadorias c/ IVA dedutível');
      linhasIniciais = [
        {
          ordem: 1,
          conta_codigo: '21.2',
          conta_nome: t('lancamentosUi.tplPurchaseAcc1', 'Mercadorias'),
          debito: '',
          credito: '',
          descricao_linha: t('lancamentosUi.tplPurchaseLine1', 'Valor base da compra'),
          terceiro_nome: '',
          terceiro_nif: '',
        },
        {
          ordem: 2,
          conta_codigo: '34.5.2.1',
          conta_nome: t('lancamentosUi.tplPurchaseAcc2', 'IVA - Suportado / Dedutível Operações Gerais'),
          debito: '',
          credito: '',
          descricao_linha: t('lancamentosUi.tplPurchaseLine2', 'IVA 14%'),
          terceiro_nome: '',
          terceiro_nif: '',
        },
        {
          ordem: 3,
          conta_codigo: '32.1.1',
          conta_nome: t('lancamentosUi.tplPurchaseAcc3', 'Fornecedores Nacionais - Conta Corrente'),
          debito: '',
          credito: '',
          descricao_linha: t('lancamentosUi.tplPurchaseLine3', 'Total faturado pelo fornecedor'),
          terceiro_nome: '',
          terceiro_nif: '',
        },
      ];
    } else if (template === 'venda_iva') {
      tipoInicial = 'VENDAS';
      descInicial = t('lancamentosUi.tplSaleDesc', 'Prestação de serviços / Venda com IVA liquidado');
      linhasIniciais = [
        {
          ordem: 1,
          conta_codigo: '31.1.1',
          conta_nome: t('lancamentosUi.tplSaleAcc1', 'Clientes Nacionais - Conta Corrente'),
          debito: '',
          credito: '',
          descricao_linha: t('lancamentosUi.tplSaleLine1', 'Total a receber do cliente'),
          terceiro_nome: '',
          terceiro_nif: '',
        },
        {
          ordem: 2,
          conta_codigo: '61.1',
          conta_nome: t('lancamentosUi.tplSaleAcc2', 'Vendas de Mercadorias'),
          debito: '',
          credito: '',
          descricao_linha: t('lancamentosUi.tplSaleLine2', 'Receita líquida de vendas'),
          terceiro_nome: '',
          terceiro_nif: '',
        },
        {
          ordem: 3,
          conta_codigo: '34.5.3.1',
          conta_nome: t('lancamentosUi.tplSaleAcc3', 'IVA - Liquidado Operações Gerais'),
          debito: '',
          credito: '',
          descricao_linha: t('lancamentosUi.tplSaleLine3', 'IVA 14% a pagar à AGT'),
          terceiro_nome: '',
          terceiro_nif: '',
        },
      ];
    } else if (template === 'salarios') {
      tipoInicial = 'OPERACOES_DIVERSAS';
      descInicial = t('lancamentosUi.tplPayrollDesc', 'Processamento de salários mensais do pessoal');
      linhasIniciais = [
        {
          ordem: 1,
          conta_codigo: '75.1',
          conta_nome: t('lancamentosUi.tplPayrollAcc1', 'Remunerações dos Órgãos Sociais e Pessoal'),
          debito: '',
          credito: '',
          descricao_linha: t('lancamentosUi.tplPayrollLine1', 'Vencimento ilíquido'),
          terceiro_nome: '',
          terceiro_nif: '',
        },
        {
          ordem: 2,
          conta_codigo: '34.2',
          conta_nome: t('lancamentosUi.tplPayrollAcc2', 'Imposto sobre o Rendimento do Trabalho (IRT)'),
          debito: '',
          credito: '',
          descricao_linha: t('lancamentosUi.tplPayrollLine2', 'Retenção de IRT tabela AGT'),
          terceiro_nome: '',
          terceiro_nif: '',
        },
        {
          ordem: 3,
          conta_codigo: '34.3',
          conta_nome: t('lancamentosUi.tplPayrollAcc3', 'Segurança Social (INSS 3%)'),
          debito: '',
          credito: '',
          descricao_linha: t('lancamentosUi.tplPayrollLine3', 'Desconto INSS trabalhador'),
          terceiro_nome: '',
          terceiro_nif: '',
        },
        {
          ordem: 4,
          conta_codigo: '43.1.2',
          conta_nome: t('lancamentosUi.tplPayrollAcc4', 'Bancos - Depósitos à Ordem em Moeda Nacional'),
          debito: '',
          credito: '',
          descricao_linha: t('lancamentosUi.tplPayrollLine4', 'Transferência líquida bancária'),
          terceiro_nome: '',
          terceiro_nif: '',
        },
      ];
    }

    setFormLancamento({
      data_lancamento: `${ano || 2026}-${String(mes || 7).padStart(2, '0')}-05`,
      tipo_diario: tipoInicial,
      descricao: descInicial,
      documento_referencia: '',
      linhas: linhasIniciais,
    });
    setModalAberto(true);
  };

  // Alterar Linha de Lançamento
  const handleLinhaChange = (index, campo, valor) => {
    const novas = [...formLancamento.linhas];
    novas[index][campo] = valor;

    // Se selecionou uma conta do PGC, autocompletar o nome da conta
    if (campo === 'conta_codigo') {
      const contaAchada = contasPgc.find((c) => c.codigo === valor || c.codigo.startsWith(valor));
      if (contaAchada) {
        novas[index].conta_nome = contaAchada.nome;
      }
    }

    setFormLancamento({ ...formLancamento, linhas: novas });
  };

  const adicionarLinha = () => {
    setFormLancamento({
      ...formLancamento,
      linhas: [
        ...formLancamento.linhas,
        {
          ordem: formLancamento.linhas.length + 1,
          conta_codigo: '',
          conta_nome: '',
          debito: '',
          credito: '',
          descricao_linha: '',
          terceiro_nome: '',
          terceiro_nif: '',
        },
      ],
    });
  };

  const removerLinha = (index) => {
    if (formLancamento.linhas.length <= 2) {
      toast.warning(
        t('lancamentosUi.minTwoLinesWarn', 'O lançamento deve conter pelo menos 2 linhas (partidas dobradas).')
      );
      return;
    }
    const novas = formLancamento.linhas.filter((_, i) => i !== index).map((l, i) => ({ ...l, ordem: i + 1 }));
    setFormLancamento({ ...formLancamento, linhas: novas });
  };

  // Guardar Lançamento
  const salvarLancamento = async (e) => {
    e.preventDefault();
    if (!formLancamento.descricao.trim()) {
      toast.warning(t('lancamentosUi.descriptionRequiredWarn', 'O descritivo do lançamento é obrigatório.'));
      return;
    }
    if (!totaisForm.balanceado) {
      toast.error(
        t('lancamentosUi.unbalancedEntryError', {
          debito: totaisForm.debito,
          credito: totaisForm.credito,
          diferenca: totaisForm.diferenca,
          defaultValue:
            'Lançamento desbalanceado: Débito ({{debito}} Kz) != Crédito ({{credito}} Kz). A diferença é de {{diferenca}} Kz.',
        })
      );
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        empresa_id: empresaId,
        ano: Number(ano || 2026),
        mes: Number(mes || 7),
        data_lancamento: formLancamento.data_lancamento,
        tipo_diario: formLancamento.tipo_diario,
        descricao: formLancamento.descricao.trim(),
        documento_referencia: formLancamento.documento_referencia.trim(),
        total_debito: totaisForm.debito,
        total_credito: totaisForm.credito,
        linhas: formLancamento.linhas.map((l) => ({
          ...l,
          debito: parseFloat(String(l.debito || 0).replace(',', '.')) || 0,
          credito: parseFloat(String(l.credito || 0).replace(',', '.')) || 0,
        })),
      };

      if (edicaoId) {
        await lancamentoService.update(edicaoId, payload);
        toast.success(t('lancamentosUi.updateSuccess', 'Lançamento contabilístico atualizado com sucesso!'));
      } else {
        await lancamentoService.create(payload);
        toast.success(
          t('lancamentosUi.createSuccess', 'Lançamento contabilístico registado no Livro Diário com sucesso!')
        );
      }

      setModalAberto(false);
      carregarDados();
    } catch (err) {
      const msg =
        err.response?.data?.non_field_errors ||
        err.response?.data?.error ||
        t('lancamentosUi.saveError', 'Erro ao guardar lançamento contabilístico.');
      toast.error(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally {
      setSalvando(false);
    }
  };

  const apagarLancamento = async (id) => {
    if (
      !window.confirm(
        t('lancamentosUi.deleteConfirm', 'Tem a certeza que deseja anular e eliminar este lançamento contabilístico?')
      )
    )
      return;
    try {
      await lancamentoService.delete(id);
      toast.success(t('lancamentosUi.deleteSuccess', 'Lançamento eliminado do diário.'));
      carregarDados();
    } catch {
      toast.error(t('lancamentosUi.deleteError', 'Erro ao eliminar lançamento.'));
    }
  };

  return (
    <div className="container-fluid" style={{ padding: '24px 20px' }}>
      {/* CABEÇALHO */}
      <div className="d-flex align-items-center justify-content-between mb-20 flex-wrap" style={{ gap: 12 }}>
        <div>
          <h4 className="text-dark fw-700 mb-4" style={{ fontSize: 22 }}>
            <i className="la la-book-open text-primary mr-2"></i>
            {t('accounting.title', 'Escrituração Contabilística (Livro Diário & Razão)')}
          </h4>
          <p className="text-muted mb-0" style={{ fontSize: 13 }}>
            {t('accounting.subtitle', 'Registo de lançamentos por partidas dobradas em conformidade com o Plano Geral de Contabilidade de Angola (Decreto n.º 82/01).')}
          </p>
        </div>

        <div className="d-flex align-items-center flex-wrap" style={{ gap: 10 }}>
          <div className="dropdown">
            <button
              type="button"
              className="btn btn-sm btn-outline-primary dropdown-toggle"
              data-toggle="dropdown"
              style={{ borderRadius: 6, fontWeight: 600, height: 38, padding: '0 14px' }}
            >
              <i className="la la-magic mr-1"></i> {t('lancamentosUi.btnQuickTemplates', 'Templates Rápidos')}
            </button>
            <div className="dropdown-menu dropdown-menu-right">
              <button className="dropdown-item py-2" onClick={() => abrirModalNovo('compra_iva')}>
                <i className="la la-shopping-cart text-primary mr-2"></i> {t('lancamentosUi.tplMenuPurchaseVat', 'Compra c/ IVA 14%')}
              </button>
              <button className="dropdown-item py-2" onClick={() => abrirModalNovo('venda_iva')}>
                <i className="la la-tag text-success mr-2"></i> {t('lancamentosUi.tplMenuSaleVat', 'Venda / Prestação c/ IVA 14%')}
              </button>
              <button className="dropdown-item py-2" onClick={() => abrirModalNovo('salarios')}>
                <i className="la la-users text-warning mr-2"></i> {t('lancamentosUi.tplMenuPayroll', 'Salários, IRT & INSS 3%')}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => abrirModalNovo()}
            style={{ borderRadius: 6, fontWeight: 600, height: 38, padding: '0 16px' }}
          >
            <i className="la la-plus-circle mr-1"></i> {t('lancamentosUi.btnNewEntry', 'Novo Lançamento')}
          </button>
        </div>
      </div>

      {/* FLUXO CONTABILÍSTICO OFICIAL PASSO A PASSO (1 -> 4) */}
      <div className="card card-default mb-20" style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '12px 18px', borderBottom: '1px solid #e2e8f0' }} className="d-flex align-items-center justify-content-between flex-wrap">
          <div className="d-flex align-items-center" style={{ gap: 8 }}>
            <span className="badge badge-primary" style={{ padding: '5px 9px', fontSize: 11, fontWeight: 700 }}>
              {t('lancamentosUi.workflowBadge', 'FLUXO OPERACIONAL')}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
              {t('lancamentosUi.workflowTitle', 'Ciclo Contabilístico Angolano (PGC - Decreto n.º 82/01)')}
            </span>
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {t('lancamentosUi.workflowSubtitle', 'Etapas sequenciais da escrituração ao fecho de contas')}
          </span>
        </div>

        <div className="p-16">
          <div className="row g-2">
            {/* PASSO 1 */}
            <div className="col-12 col-md-3 mb-10 mb-md-0">
              <Link
                to="/arquivo"
                className="card h-100 p-12 text-decoration-none"
                style={{
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-6">
                  <span className="badge badge-light border text-muted" style={{ fontSize: 10, fontWeight: 700 }}>
                    {t('lancamentosUi.step1Badge', 'PASSO 1')}
                  </span>
                  <i className="la la-folder-open text-primary" style={{ fontSize: 18 }}></i>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#1e293b' }}>
                  {t('lancamentosUi.step1Title', '1. Documentos & Suportes')}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  {t('lancamentosUi.step1Desc', 'Entrada e arquivo de faturas, recibos e extratos.')}
                </div>
              </Link>
            </div>

            {/* PASSO 2 */}
            <div className="col-12 col-md-3 mb-10 mb-md-0">
              <div
                onClick={() => { setAbaAtiva('diario'); navigate('/diario'); }}
                className="card h-100 p-12"
                style={{
                  borderRadius: 8,
                  border: abaAtiva === 'diario' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  backgroundColor: abaAtiva === 'diario' ? '#f5f6fe' : '#ffffff',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-6">
                  <span className={`badge ${abaAtiva === 'diario' ? 'badge-primary' : 'badge-light border text-muted'}`} style={{ fontSize: 10, fontWeight: 700 }}>
                    {t('lancamentosUi.step2Badge', 'PASSO 2')} {abaAtiva === 'diario' && `• ${t('lancamentosUi.activeBadge', 'ATIVO')}`}
                  </span>
                  <i className="la la-book-open text-primary" style={{ fontSize: 18 }}></i>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: abaAtiva === 'diario' ? '#2563eb' : '#1e293b' }}>
                  {t('lancamentosUi.step2Title', '2. Livro Diário')}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  {t('lancamentosUi.step2Desc', 'Escrituração por Partidas Dobradas (Débito = Crédito).')}
                </div>
              </div>
            </div>

            {/* PASSO 3 */}
            <div className="col-12 col-md-3 mb-10 mb-md-0">
              <div
                onClick={() => { setAbaAtiva('razao'); navigate('/razao'); }}
                className="card h-100 p-12"
                style={{
                  borderRadius: 8,
                  border: abaAtiva === 'razao' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  backgroundColor: abaAtiva === 'razao' ? '#f5f6fe' : '#ffffff',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-6">
                  <span className={`badge ${abaAtiva === 'razao' ? 'badge-primary' : 'badge-light border text-muted'}`} style={{ fontSize: 10, fontWeight: 700 }}>
                    {t('lancamentosUi.step3Badge', 'PASSO 3')} {abaAtiva === 'razao' && `• ${t('lancamentosUi.activeBadge', 'ATIVO')}`}
                  </span>
                  <i className="la la-balance-scale text-primary" style={{ fontSize: 18 }}></i>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: abaAtiva === 'razao' ? '#2563eb' : '#1e293b' }}>
                  {t('lancamentosUi.step3Title', '3. Livro Razão')}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  {t('lancamentosUi.step3Desc', 'Conferência e extratos de movimentos por conta PGC.')}
                </div>
              </div>
            </div>

            {/* PASSO 4 */}
            <div className="col-12 col-md-3">
              <div
                onClick={() => { setAbaAtiva('balancete_gerado'); navigate('/balancete'); }}
                className="card h-100 p-12"
                style={{
                  borderRadius: 8,
                  border: abaAtiva === 'balancete_gerado' ? '2px solid #00a854' : '1px solid #e2e8f0',
                  backgroundColor: abaAtiva === 'balancete_gerado' ? '#e6f7ef' : '#ffffff',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-6">
                  <span className={`badge ${abaAtiva === 'balancete_gerado' ? 'badge-success' : 'badge-success-light'}`} style={{ fontSize: 10, fontWeight: 700, backgroundColor: '#e6f7ef', color: '#00a854', border: '1px solid #b7eb8f' }}>
                    {t('lancamentosUi.step4Badge', 'RESULTADO FINAL')} {abaAtiva === 'balancete_gerado' && `• ${t('lancamentosUi.activeBadge', 'ATIVO')}`}
                  </span>
                  <i className="la la-chart-bar text-success" style={{ fontSize: 18 }}></i>
                </div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: abaAtiva === 'balancete_gerado' ? '#00a854' : '#1e293b' }}>
                  {t('lancamentosUi.step4Title', '4. Balancete & Fecho')}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  {t('lancamentosUi.step4Desc', 'Balancete de Verificação de 8 Classes e Posição Financeira.')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ABAS SUPERIORES DA CONTABILIDADE */}
      <div className="card card-default mb-20" style={{ borderRadius: 8 }}>
        <div className="d-flex align-items-center flex-wrap px-16 py-8" style={{ gap: 8, borderBottom: '1px solid #f1f2f6' }}>
          {[
            { key: 'diario', path: '/diario', label: t('lancamentosUi.tabJournal', '2. Livro Diário (Lançamentos)'), icon: 'la-list' },
            { key: 'razao', path: '/razao', label: t('lancamentosUi.tabLedger', '3. Livro Razão (Extrato de Contas PGC)'), icon: 'la-layer-group' },
            { key: 'balancete_gerado', path: '/balancete', label: t('lancamentosUi.tabTrialBalance', '4. Balancete & Fecho (8 Classes PGC)'), icon: 'la-table', isFinal: true },
          ].map((tab) => {
            const ativa = abaAtiva === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className="btn btn-link"
                onClick={() => {
                  setAbaAtiva(tab.key);
                  if (tab.path) navigate(tab.path);
                }}
                style={{
                  fontWeight: ativa ? 700 : 500,
                  color: ativa ? (tab.isFinal ? '#00a854' : '#2563eb') : '#64748b',
                  borderBottom: ativa ? (tab.isFinal ? '2px solid #00a854' : '2px solid #2563eb') : '2px solid transparent',
                  borderRadius: 0,
                  fontSize: 13.5,
                  padding: '10px 16px',
                  textDecoration: 'none',
                }}
              >
                <i className={`la ${tab.icon} mr-1`}></i> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ABA 1: LIVRO DIÁRIO */}
      {abaAtiva === 'diario' && (
        <div>
          {/* BARRA DE FILTROS */}
          <div className="card card-default mb-20">
            <div className="card-body p-16">
              <div className="row align-items-center">
                <div className="col-md-5 mb-10 mb-md-0">
                  <div className="position-relative">
                    <i className="la la-search position-absolute" style={{ left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={t('lancamentosUi.searchJournalPlaceholder', 'Pesquisar por n.º diário, descritivo, fatura ou terceiro...')}
                      value={pesquisaDiario}
                      onChange={(e) => setPesquisaDiario(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && carregarDados()}
                      style={{ paddingLeft: 36, fontSize: 13, borderRadius: 6 }}
                    />
                  </div>
                </div>

                <div className="col-md-4 mb-10 mb-md-0">
                  <select
                    className="form-control"
                    value={filtroTipoDiario}
                    onChange={(e) => setFiltroTipoDiario(e.target.value)}
                    style={{ fontSize: 13, borderRadius: 6 }}
                  >
                    <option value="TODOS">{t('lancamentosUi.allJournals', 'Todos os Diários')}</option>
                    {TIPOS_DIARIO.map((td) => (
                      <option key={td.valor} value={td.valor}>{t(td.labelKey, td.label)}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3 text-md-right">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={carregarDados}
                    style={{ borderRadius: 6, fontSize: 12.5 }}
                  >
                    <i className="la la-sync mr-1"></i> {t('lancamentosUi.btnRefreshJournal', 'Atualizar Diário')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* TABELA DE LANÇAMENTOS DO DIÁRIO */}
          <div className="card card-default mb-25">
            <div className="card-header bg-white py-14 px-20 border-bottom d-flex align-items-center justify-content-between">
              <h5 className="fw-700 text-dark mb-0">
                {t('lancamentosUi.journalPeriodCount', {
                  count: lancamentos.length,
                  mes,
                  ano,
                  defaultValue: '{{count}} Lançamento(s) Registado(s) no Período ({{mes}}/{{ano}})',
                })}
              </h5>
              <span className="badge badge-light border">
                {t('lancamentosUi.mandatoryAccountingEquation', 'Equação Patrimonial Obrigatória')}
              </span>
            </div>

            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                  <thead style={{ backgroundColor: '#ffffff' }}>
                    <tr>
                      <th style={{ width: 130, padding: '12px 16px' }}>{t('lancamentosUi.thJournalNo', 'N.º Diário')}</th>
                      <th style={{ width: 110, padding: '12px 16px' }}>{t('lancamentosUi.thDate', 'Data')}</th>
                      <th style={{ width: 160, padding: '12px 16px' }}>{t('lancamentosUi.thType', 'Tipo')}</th>
                      <th style={{ padding: '12px 16px' }}>{t('lancamentosUi.thDescription', 'Descrição / Histórico')}</th>
                      <th style={{ width: 140, padding: '12px 16px' }}>{t('lancamentosUi.thSupportDoc', 'Doc. Suporte')}</th>
                      <th style={{ width: 150, padding: '12px 16px', textAlign: 'right' }}>{t('lancamentosUi.thTotalDebitCredit', 'Total Débito / Crédito')}</th>
                      <th style={{ width: 90, padding: '12px 16px', textAlign: 'center' }}>{t('lancamentosUi.thActions', 'Ações')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentos.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-40 text-muted">
                          <i className="la la-book-open d-block mb-2 text-muted" style={{ fontSize: 32 }}></i>
                          {t('lancamentosUi.emptyJournalPeriod', 'Nenhum lançamento contabilístico encontrado para este período.')}
                          <div className="mt-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => abrirModalNovo()}
                            >
                              <i className="la la-plus mr-1"></i> {t('lancamentosUi.btnRegisterFirstEntry', 'Registar Primeiro Lançamento')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      lancamentos.map((l) => {
                        const expandido = lancamentoExpandido === l.id;
                        return (
                          <React.Fragment key={l.id}>
                            <tr
                              onClick={() => setLancamentoExpandido(expandido ? null : l.id)}
                              style={{ cursor: 'pointer', backgroundColor: expandido ? '#f8f9fe' : 'transparent' }}
                            >
                              <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace', color: '#2563eb' }}>
                                <i className={`la ${expandido ? 'la-angle-down' : 'la-angle-right'} mr-1`}></i>
                                {l.numero_diario}
                              </td>
                              <td style={{ padding: '12px 16px' }}>{l.data_lancamento}</td>
                              <td style={{ padding: '12px 16px' }}>
                                <span className="badge badge-light border" style={{ fontSize: 11 }}>
                                  {getTipoDiarioLabel(l.tipo_diario)}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', fontWeight: 600, color: '#272b41' }}>
                                {l.descricao}
                              </td>
                              <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12 }}>
                                {l.documento_referencia || '-'}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>
                                {kzComMoeda(l.total_debito)}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-outline-danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    apagarLancamento(l.id);
                                  }}
                                  title={t('lancamentosUi.btnDeleteEntryTitle', 'Eliminar Lançamento')}
                                  style={{ borderRadius: 4, padding: '3px 7px' }}
                                >
                                  <i className="la la-trash"></i>
                                </button>
                              </td>
                            </tr>

                            {/* LINHAS EXPANDIDAS DO LANÇAMENTO */}
                            {expandido && (
                              <tr style={{ backgroundColor: '#ffffff' }}>
                                <td colSpan="7" style={{ padding: '16px 24px' }}>
                                  <div className="card card-default mb-0" style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                    <div className="card-body p-0">
                                      <table className="table table-sm mb-0" style={{ fontSize: 12.5 }}>
                                        <thead style={{ backgroundColor: '#ffffff' }}>
                                          <tr>
                                            <th style={{ width: 110, padding: '8px 12px' }}>{t('lancamentosUi.thPgcAccount', 'Conta PGC')}</th>
                                            <th style={{ padding: '8px 12px' }}>{t('lancamentosUi.thOfficialName', 'Designação Oficial')}</th>
                                            <th style={{ width: 160, padding: '8px 12px' }}>{t('lancamentosUi.thThirdPartyClientSupplier', 'Terceiro (Cliente/Fornecedor)')}</th>
                                            <th style={{ width: 140, padding: '8px 12px', textAlign: 'right', color: '#166534' }}>{t('lancamentosUi.thDebitD', 'Débito (D)')}</th>
                                            <th style={{ width: 140, padding: '8px 12px', textAlign: 'right', color: '#991b1b' }}>{t('lancamentosUi.thCreditC', 'Crédito (C)')}</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(l.linhas || []).map((linha, idx) => (
                                            <tr key={idx}>
                                              <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                                                {linha.conta_codigo}
                                              </td>
                                              <td style={{ padding: '8px 12px' }}>{linha.conta_nome}</td>
                                              <td style={{ padding: '8px 12px', color: '#64748b' }}>
                                                {linha.terceiro_nome ? `${linha.terceiro_nome} (${linha.terceiro_nif || ''})` : '-'}
                                              </td>
                                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#166534' }}>
                                                {parseFloat(linha.debito) > 0 ? kzComMoeda(linha.debito) : '-'}
                                              </td>
                                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#991b1b' }}>
                                                {parseFloat(linha.credito) > 0 ? kzComMoeda(linha.credito) : '-'}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: LIVRO RAZÃO (EXTRATO DE CONTAS PGC) */}
      {abaAtiva === 'razao' && (
        <div>
          <div className="card card-default mb-20">
            <div className="card-body p-16">
              <div className="row align-items-center">
                <div className="col-md-6 mb-10 mb-md-0">
                  <div className="position-relative">
                    <i className="la la-filter position-absolute" style={{ left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={t('lancamentosUi.filterAccountPlaceholder', 'Filtrar por código de conta (ex: 43.1, 31.1, 34.5)...')}
                      value={razaoContaFiltro}
                      onChange={(e) => setRazaoContaFiltro(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && carregarDados()}
                      style={{ paddingLeft: 36, fontSize: 13, borderRadius: 6 }}
                    />
                  </div>
                </div>
                <div className="col-md-6 text-md-right">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={carregarDados}
                    style={{ borderRadius: 6, fontSize: 12.5 }}
                  >
                    <i className="la la-search mr-1"></i> {t('lancamentosUi.btnQueryLedger', 'Consultar Razão')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {(razaoDados.contas || []).length === 0 ? (
            <div className="card card-default p-40 text-center text-muted">
              <i className="la la-layer-group mb-2 d-block text-muted" style={{ fontSize: 32 }}></i>
              {t('lancamentosUi.emptyLedger', 'Nenhuma conta movimentada encontrada para o filtro selecionado.')}
            </div>
          ) : (
            (razaoDados.contas || []).map((c) => (
              <div key={c.conta_codigo} className="card card-default mb-25" style={{ borderRadius: 8 }}>
                <div className="card-header bg-white py-14 px-20 border-bottom d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
                  <div>
                    <span className="badge badge-primary mr-2" style={{ fontFamily: 'monospace', fontSize: 13 }}>
                      {c.conta_codigo}
                    </span>
                    <strong className="text-dark" style={{ fontSize: 15 }}>{c.conta_nome}</strong>
                  </div>
                  <div className="d-flex align-items-center flex-wrap" style={{ gap: 12 }}>
                    <span className="text-muted" style={{ fontSize: 12.5 }}>
                      {t('lancamentosUi.totalDebitLabel', 'Total Débito:')} <strong className="text-success">{kzComMoeda(c.total_debito)}</strong>
                    </span>
                    <span className="text-muted" style={{ fontSize: 12.5 }}>
                      {t('lancamentosUi.totalCreditLabel', 'Total Crédito:')} <strong className="text-danger">{kzComMoeda(c.total_credito)}</strong>
                    </span>
                    <span className="badge badge-light border p-2" style={{ fontSize: 12 }}>
                      {t('lancamentosUi.currentBalanceLabel', 'Saldo Atual:')}{' '}
                      <strong className={c.natureza_saldo === 'Devedor' ? 'text-success' : 'text-danger'}>
                        {kzComMoeda(c.saldo_final)} (
                        {c.natureza_saldo === 'Devedor'
                          ? t('lancamentosUi.natureDebit', 'Devedor')
                          : c.natureza_saldo === 'Credor'
                          ? t('lancamentosUi.natureCredit', 'Credor')
                          : c.natureza_saldo}
                        )
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 12.5 }}>
                      <thead style={{ backgroundColor: '#ffffff' }}>
                        <tr>
                          <th style={{ width: 100, padding: '10px 14px' }}>{t('lancamentosUi.thDate', 'Data')}</th>
                          <th style={{ width: 130, padding: '10px 14px' }}>{t('lancamentosUi.thJournalNo', 'N.º Diário')}</th>
                          <th style={{ padding: '10px 14px' }}>{t('lancamentosUi.thDescription', 'Descrição / Histórico')}</th>
                          <th style={{ width: 150, padding: '10px 14px' }}>{t('lancamentosUi.thThirdParty', 'Terceiro')}</th>
                          <th style={{ width: 130, padding: '10px 14px', textAlign: 'right', color: '#166534' }}>{t('lancamentosUi.thDebit', 'Débito')}</th>
                          <th style={{ width: 130, padding: '10px 14px', textAlign: 'right', color: '#991b1b' }}>{t('lancamentosUi.thCredit', 'Crédito')}</th>
                          <th style={{ width: 140, padding: '10px 14px', textAlign: 'right' }}>{t('lancamentosUi.thRunningBalance', 'Saldo Acumulado')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.movimentos.map((m, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '8px 14px' }}>{m.data}</td>
                            <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>{m.numero_diario}</td>
                            <td style={{ padding: '8px 14px' }}>{m.descricao}</td>
                            <td style={{ padding: '8px 14px', color: '#64748b' }}>{m.terceiro_nome || '-'}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#166534' }}>
                              {parseFloat(m.debito) > 0 ? kzComMoeda(m.debito) : '-'}
                            </td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: '#991b1b' }}>
                              {parseFloat(m.credito) > 0 ? kzComMoeda(m.credito) : '-'}
                            </td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700 }}>
                              {kzComMoeda(m.saldo_apos)}{' '}
                              <span style={{ fontSize: 10, color: '#64748b' }}>
                                ({m.natureza_apos === 'Devedor'
                                  ? t('lancamentosUi.natureDebitShort', 'D')
                                  : m.natureza_apos === 'Credor'
                                  ? t('lancamentosUi.natureCreditShort', 'C')
                                  : (m.natureza_apos || '')[0]})
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ABA 3: BALANCETE AUTOMÁTICO (8 CLASSES PGC) */}
      {abaAtiva === 'balancete_gerado' && (
        <div>
          {balanceteDados && (
            <div className="card card-default mb-25" style={{ borderRadius: 8 }}>
              <div className="card-header bg-white py-16 px-20 border-bottom d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
                <div>
                  <h5 className="fw-700 text-dark mb-0">
                    {t('lancamentosUi.trialBalanceTitle', {
                      mes,
                      ano,
                      defaultValue: 'Balancete de Verificação Oficial do Exercício ({{mes}}/{{ano}})',
                    })}
                  </h5>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {t('lancamentosUi.trialBalanceSubtitle', {
                      count: balanceteDados.total_contas,
                      defaultValue: 'Plano Geral de Contabilidade (Decreto n.º 82/01) · {{count}} conta(s) com movimento',
                    })}
                  </span>
                </div>

                <div className="d-flex align-items-center" style={{ gap: 8 }}>
                  <span className={`badge ${balanceteDados.balanceado ? 'badge-success' : 'badge-danger'} p-2`} style={{ fontSize: 12 }}>
                    <i className={`la ${balanceteDados.balanceado ? 'la-check-circle' : 'la-exclamation-triangle'} mr-1`}></i>
                    {balanceteDados.balanceado
                      ? t('lancamentosUi.trialBalanceBalanced', 'Balancete Balanceado')
                      : t('lancamentosUi.trialBalanceUnbalanced', 'Balancete Desbalanceado')}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => window.print()}
                    style={{ borderRadius: 6, fontWeight: 600 }}
                  >
                    <i className="la la-print mr-1"></i> {t('lancamentosUi.btnPrintTrialBalance', 'Imprimir Balancete')}
                  </button>
                </div>
              </div>

              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                    <thead style={{ backgroundColor: '#ffffff' }}>
                      <tr>
                        <th style={{ width: 110, padding: '12px 16px' }}>{t('lancamentosUi.thCode', 'Código')}</th>
                        <th style={{ minWidth: 240, padding: '12px 16px' }}>{t('lancamentosUi.thPgcAccountName', 'Designação da Conta PGC')}</th>
                        <th style={{ width: 140, padding: '12px 16px', textAlign: 'right', color: '#166534' }}>{t('lancamentosUi.thMonthDebit', 'Débito Mês')}</th>
                        <th style={{ width: 140, padding: '12px 16px', textAlign: 'right', color: '#991b1b' }}>{t('lancamentosUi.thMonthCredit', 'Crédito Mês')}</th>
                        <th style={{ width: 150, padding: '12px 16px', textAlign: 'right', color: '#166534' }}>{t('lancamentosUi.thAccumDebit', 'Débito Acum.')}</th>
                        <th style={{ width: 150, padding: '12px 16px', textAlign: 'right', color: '#991b1b' }}>{t('lancamentosUi.thAccumCredit', 'Crédito Acum.')}</th>
                        <th style={{ width: 150, padding: '12px 16px', textAlign: 'right' }}>{t('lancamentosUi.thDebitBalance', 'Saldo Devedor')}</th>
                        <th style={{ width: 150, padding: '12px 16px', textAlign: 'right' }}>{t('lancamentosUi.thCreditBalance', 'Saldo Credor')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanceteDados.linhas.map((l) => (
                        <tr key={l.codigo}>
                          <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                            {l.codigo}
                          </td>
                          <td style={{ padding: '10px 16px', fontWeight: 600, color: '#272b41' }}>
                            {l.nome}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: '#166534' }}>
                            {parseFloat(l.debito_mes) > 0 ? kzComMoeda(l.debito_mes) : '-'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: '#991b1b' }}>
                            {parseFloat(l.credito_mes) > 0 ? kzComMoeda(l.credito_mes) : '-'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: '#166534' }}>
                            {kzComMoeda(l.debito_acumulado)}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: '#991b1b' }}>
                            {kzComMoeda(l.credito_acumulado)}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>
                            {parseFloat(l.saldo_devedor) > 0 ? kzComMoeda(l.saldo_devedor) : '-'}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: '#991b1b' }}>
                            {parseFloat(l.saldo_credor) > 0 ? kzComMoeda(l.saldo_credor) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot style={{ backgroundColor: '#ffffff', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
                      <tr>
                        <td colSpan="2" style={{ padding: '12px 16px', fontSize: 13.5 }}>{t('lancamentosUi.grandTotals', 'TOTAIS GERAIS:')}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#166534' }}>
                          {kzComMoeda(balanceteDados.totais.total_debito_mes)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#991b1b' }}>
                          {kzComMoeda(balanceteDados.totais.total_credito_mes)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#166534' }}>
                          {kzComMoeda(balanceteDados.totais.total_debito_acumulado)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#991b1b' }}>
                          {kzComMoeda(balanceteDados.totais.total_credito_acumulado)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#166534', fontSize: 14 }}>
                          {kzComMoeda(balanceteDados.totais.total_saldo_devedor)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#991b1b', fontSize: 14 }}>
                          {kzComMoeda(balanceteDados.totais.total_saldo_credor)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL INTELIGENTE DE NOVO LANÇAMENTO (PARTIDAS DOBRADAS)   */}
      {/* ========================================================= */}
      {modalAberto && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1060 }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 12 }}>
              <div className="modal-header bg-white border-bottom py-16 px-24">
                <h5 className="modal-title fw-700 text-dark mb-0">
                  <i className="la la-edit text-primary mr-2"></i>
                  {edicaoId
                    ? t('lancamentosUi.modalEditTitle', 'Editar Lançamento Contabilístico')
                    : t('lancamentosUi.modalNewTitle', 'Novo Lançamento no Livro Diário')}
                </h5>
                <button type="button" className="close" onClick={() => setModalAberto(false)}>
                  &times;
                </button>
              </div>

              <form onSubmit={salvarLancamento}>
                <div className="modal-body p-24" style={{ backgroundColor: '#ffffff' }}>
                  {/* CABEÇALHO DO LANÇAMENTO */}
                  <div className="row mb-20">
                    <div className="col-md-3 mb-10">
                      <label className="form-label font-weight-bold" style={{ fontSize: 12.5 }}>
                        {t('lancamentosUi.fieldEntryDate', 'Data do Lançamento *')}
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={formLancamento.data_lancamento}
                        onChange={(e) => setFormLancamento({ ...formLancamento, data_lancamento: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>

                    <div className="col-md-3 mb-10">
                      <label className="form-label font-weight-bold" style={{ fontSize: 12.5 }}>
                        {t('lancamentosUi.fieldAccountingJournal', 'Diário Contabilístico *')}
                      </label>
                      <select
                        className="form-control"
                        value={formLancamento.tipo_diario}
                        onChange={(e) => setFormLancamento({ ...formLancamento, tipo_diario: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      >
                        {TIPOS_DIARIO.map((td) => (
                          <option key={td.valor} value={td.valor}>{t(td.labelKey, td.label)}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-3 mb-10">
                      <label className="form-label font-weight-bold" style={{ fontSize: 12.5 }}>
                        {t('lancamentosUi.fieldRefDocInvoice', 'Doc. Referência / Fatura')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={t('lancamentosUi.fieldRefDocPlaceholder', 'Ex: FT 2026/045 ou REC-12')}
                        value={formLancamento.documento_referencia}
                        onChange={(e) => setFormLancamento({ ...formLancamento, documento_referencia: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>

                    <div className="col-md-3 mb-10">
                      <label className="form-label font-weight-bold" style={{ fontSize: 12.5 }}>
                        {t('lancamentosUi.fieldAccountingEquation', 'Equação Patrimonial')}
                      </label>
                      <div
                        className="p-2 rounded text-center font-weight-bold"
                        style={{
                          backgroundColor: totaisForm.balanceado ? '#ecfdf5' : '#fef2f2',
                          color: totaisForm.balanceado ? '#065f46' : '#991b1b',
                          border: `1px solid ${totaisForm.balanceado ? '#a7f3d0' : '#fecaca'}`,
                          fontSize: 12,
                        }}
                      >
                        {totaisForm.balanceado
                          ? t('lancamentosUi.equationBalanced', '✓ Débito == Crédito')
                          : t('lancamentosUi.equationUnbalanced', {
                              diff: totaisForm.diferenca,
                              defaultValue: '⚠ Desbalanceado ({{diff}} Kz)',
                            })}
                      </div>
                    </div>

                    <div className="col-12 mt-10">
                      <label className="form-label font-weight-bold" style={{ fontSize: 12.5 }}>
                        {t('lancamentosUi.fieldOperationDescription', 'Descrição / Histórico da Operação *')}
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        required
                        placeholder={t(
                          'lancamentosUi.fieldOperationDescPlaceholder',
                          'Ex: Pagamento da fatura FT 2026/045 do fornecedor de serviços informáticos...'
                        )}
                        value={formLancamento.descricao}
                        onChange={(e) => setFormLancamento({ ...formLancamento, descricao: e.target.value })}
                        style={{ borderRadius: 6, fontSize: 13 }}
                      />
                    </div>
                  </div>

                  {/* TABELA DE PARTIDAS DOBRADAS (DÉBITO E CRÉDITO) */}
                  <div className="card card-default mb-15" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div className="card-header bg-white py-10 px-16 border-bottom d-flex align-items-center justify-content-between">
                      <strong className="text-dark" style={{ fontSize: 13.5 }}>
                        {t('lancamentosUi.doubleEntryLinesTitle', 'Partidas Dobradas (Linhas de Débito e Crédito)')}
                      </strong>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-primary"
                        onClick={adicionarLinha}
                        style={{ borderRadius: 4, fontWeight: 600 }}
                      >
                        <i className="la la-plus mr-1"></i> {t('lancamentosUi.btnAddLine', 'Adicionar Linha')}
                      </button>
                    </div>

                    <div className="card-body p-0">
                      <div className="table-responsive">
                        <table className="table table-sm mb-0 align-middle" style={{ fontSize: 12.5 }}>
                          <thead style={{ backgroundColor: '#ffffff' }}>
                            <tr>
                              <th style={{ width: 40, textAlign: 'center' }}>#</th>
                              <th style={{ width: 140 }}>{t('lancamentosUi.thPgcAccountReq', 'Conta PGC *')}</th>
                              <th style={{ minWidth: 200 }}>{t('lancamentosUi.thAccountName', 'Designação da Conta')}</th>
                              <th style={{ width: 150, textAlign: 'right', color: '#166534' }}>{t('lancamentosUi.thDebitKz', 'Débito (Kz)')}</th>
                              <th style={{ width: 150, textAlign: 'right', color: '#991b1b' }}>{t('lancamentosUi.thCreditKz', 'Crédito (Kz)')}</th>
                              <th style={{ width: 160 }}>{t('lancamentosUi.thThirdPartyNameNif', 'Terceiro (Nome/NIF)')}</th>
                              <th style={{ width: 45, textAlign: 'center' }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {formLancamento.linhas.map((linha, idx) => (
                              <tr key={idx}>
                                <td style={{ textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder={t('lancamentosUi.accountCodePlaceholder', 'Ex: 31.1')}
                                    required
                                    value={linha.conta_codigo}
                                    onChange={(e) => handleLinhaChange(idx, 'conta_codigo', e.target.value)}
                                    style={{ fontFamily: 'monospace', fontWeight: 700 }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder={t('lancamentosUi.accountNamePlaceholder', 'Nome da conta...')}
                                    required
                                    value={linha.conta_nome}
                                    onChange={(e) => handleLinhaChange(idx, 'conta_nome', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="form-control form-control-sm text-right"
                                    placeholder="0,00"
                                    value={linha.debito}
                                    onChange={(e) => handleLinhaChange(idx, 'debito', e.target.value)}
                                    style={{ color: '#166534', fontWeight: 600 }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="form-control form-control-sm text-right"
                                    placeholder="0,00"
                                    value={linha.credito}
                                    onChange={(e) => handleLinhaChange(idx, 'credito', e.target.value)}
                                    style={{ color: '#991b1b', fontWeight: 600 }}
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder={t('lancamentosUi.thirdPartyPlaceholder', 'Nome ou NIF do terceiro')}
                                    value={linha.terceiro_nome}
                                    onChange={(e) => handleLinhaChange(idx, 'terceiro_nome', e.target.value)}
                                  />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    className="btn btn-xs text-danger"
                                    onClick={() => removerLinha(idx)}
                                    title={t('lancamentosUi.btnRemoveLineTitle', 'Remover linha')}
                                  >
                                    <i className="la la-trash"></i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot style={{ backgroundColor: '#ffffff', borderTop: '2px solid #cbd5e1', fontWeight: 700 }}>
                            <tr>
                              <td colSpan="3" className="text-right py-10">{t('lancamentosUi.totalsLabel', 'TOTAIS:')}</td>
                              <td className="text-right py-10 text-success" style={{ fontSize: 13.5 }}>
                                {totaisForm.debito} Kz
                              </td>
                              <td className="text-right py-10 text-danger" style={{ fontSize: 13.5 }}>
                                {totaisForm.credito} Kz
                              </td>
                              <td colSpan="2"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-white border-top py-14 px-24" style={{ gap: 8 }}>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setModalAberto(false)}>
                    {t('lancamentosUi.btnCancel', 'Cancelar')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-sm btn-primary"
                    disabled={salvando || !totaisForm.balanceado}
                    style={{ fontWeight: 600 }}
                  >
                    <i className={`la ${salvando ? 'la-spinner la-spin' : 'la-check'} mr-1`}></i>
                    {salvando
                      ? t('lancamentosUi.btnSaving', 'A Gravar...')
                      : t('lancamentosUi.btnSaveEntry', 'Gravar Lançamento no Diário')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LancamentosView;
