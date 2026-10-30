const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PT_PATH = path.join(ROOT, 'frontend/src/i18n/locales/pt.json');
const EN_PATH = path.join(ROOT, 'frontend/src/i18n/locales/en.json');
const ZH_PATH = path.join(ROOT, 'frontend/src/i18n/locales/zh.json');

const pt = JSON.parse(fs.readFileSync(PT_PATH, 'utf8'));
const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
const zh = JSON.parse(fs.readFileSync(ZH_PATH, 'utf8'));

// Deep merge helper
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// 1. Merge Layout, Auth & Admin from scratch
const scratchPath = '/home/sckj-muquissi/.gemini/antigravity/brain/61fe8b6b-72b9-4f5c-bb65-d4aa2d9875d8/scratch/i18n_layout_auth_admin.json';
if (fs.existsSync(scratchPath)) {
  const scratch = JSON.parse(fs.readFileSync(scratchPath, 'utf8'));
  deepMerge(pt, scratch.pt || {});
  deepMerge(en, scratch.en || {});
  deepMerge(zh, scratch.zh || {});
  console.log('Merged i18n_layout_auth_admin.json');
}

// 2. Translations for Confronto & Consolidação
const confrontoTranslations = {
  pt: {
    confrontoUi: {
      headerTitle: 'Confronto Contabilidade vs Portal AGT',
      headerSubtitle: 'Cruzamento inteligente em 3 passos: carregue o Balancete e o Modelo 7 para apurar os números e saldos fiscais.',
      tabAiAudit: '1. Confronto com IA',
      tabAnnualConsolidation: '2. Consolidação Anual (12 Meses)',
      tabHistory: '3. Histórico',
      pillStep1: '1. Carregar Balancete & Modelo 7',
      pillStep2: '2. Confrontar com IA',
      pillStep3: '3. Cards Numéricos, Excel & PDF',
      box1Header: '1. Balancete de Verificação (PGC)',
      box2Header: '2. Declaração Modelo 7 da AGT',
      dropzonePrompt: 'Clique ou arraste o ficheiro aqui',
      dropzoneFormats: 'Formatos suportados: PDF, XLS, XLSX, CSV (até 15MB)',
      selectFromArchive: 'Usar documento já arquivado',
      uploadNewFile: 'Subir novo ficheiro',
      selectFilePrompt: 'Selecione um ficheiro...',
      btnRunAudit: 'Executar Confronto com Inteligência Artificial',
      runningAudit: 'A confrontar documentos com Inteligência Artificial...',
      step3Done: '✓ Passo 3 Concluído',
      step3Title: 'Painel Numérico de Confronto Fiscal',
      langLabel: 'Idioma:',
      btnExportExcel: 'Exportar Excel (.xlsx)',
      btnPrintPdf: 'Imprimir / PDF',
      btnNewConfronto: 'Novo Confronto',
      downloading: 'A descarregar...',
      kpiCompliance: 'ÍNDICE DE CONFORMIDADE',
      kpiDivergences: 'DESVIOS EM KWANZAS',
      kpiPgcBalances: 'SALDOS CONTAS PGC 34.5',
      cardVendas: '(VENDAS OU SERVIÇOS)',
      cardCompras: '(COMPRAS OU DESPESAS)',
      cardApuramento: 'APURAMENTO DO IVA',
      incidenciaVendas: 'Incidência (Base de Vendas)',
      incidenciaCompras: 'Incidência (Base de Compras)',
      ivaLiquidado14: '(+) 1. IVA Liquidado (14%)',
      ivaDedutivel: '(-) 2. IVA Dedutível Suportado',
      baseDifference: 'Diferença na Base:',
      contabBalancete: 'Contabilidade (Balancete):',
      modelo7Agt: 'Modelo 7 AGT:',
      confrontoPeriodo: 'Confronto do Período:',
      ivaAPagar: 'IVA A PAGAR AO ESTADO',
      ivaRecuperar: 'IVA A RECUPERAR (CRÉDITO FISCAL)',
      ivaReembolso: 'IVA REEMBOLSO PEDIDO',
      differenceTax: 'Diferença no IVA:',
      statusFullMatch: 'Coincidência Integral',
      statusTaxDivergence: 'Divergência Fiscal',
      rubricsSectionTitle: 'Detalhamento das Rubricas Confrontadas',
      rubricsSectionSubtitle: 'Cruzamento ponto a ponto entre o Balancete e a Modelo 7',
      historyTitle: 'Relatórios de Confronto Realizados Anteriormente',
      emptyHistory: 'Nenhum confronto gravado no histórico',
      openReport: 'Abrir Relatório',
      rawOpinionToggle: 'Ver Parecer Pericial Completo (Texto da IA)',
      rawOpinionTitle: 'Parecer Técnico Pericial de Confronto Fiscal',
      viewCards: 'Ver Modo Cartões Numéricos'
    },
    consolidacaoUi: {
      fiscalYear: 'Exercício Fiscal:',
      exportExcel: 'Exportar Excel Anual (.xlsx)',
      loadingTitle: 'A consolidar os 12 meses de IVA e Balancete de Fecho...',
      loadingSubtitle: 'A apurar o volume de negócios acumulado, reconciliação de deduções e preparação do Modelo 1 do Imposto Industrial.',
      kpiVolumeIva: 'VOLUME NEGÓCIOS IVA (12M)',
      kpiProveitosContab: 'PROVEITOS CONTABILIDADE',
      kpiDiferencaAnual: 'DIFERENÇA ANUAL APURADA',
      kpiEstimativaII: 'ESTIMATIVA IMPOSTO INDUSTRIAL',
      of12MonthsDeclared: 'de 12 meses declarados',
      closingTrialBalanceCl6: 'Balancete de Fecho (Classe 6)',
      deliveryUntil: 'Entrega até',
      quadroComparativo: '1. Quadro Comparativo Anual: Contabilidade vs AGT',
      rubricaFiscal: 'Rubrica Fiscal / Base',
      contabBalanceteFecho: 'Contabilidade (Balancete de Fecho)',
      agtSoma12: 'AGT (Soma 12 Modelos 7)',
      status: 'Status',
      diferenca: 'Diferença',
      detalheMesAMes: '2. Mapa Detalhado Mês a Mês do Exercício',
      totalDeclarado: 'Total Declarado:',
      mes: 'Mês',
      declarationNum: 'Nº Declaração',
      volNegocios: 'Vol. Negócios (Kz)',
      ivaLiquidado: 'IVA Liquidado (Kz)',
      ivaDedutivel: 'IVA Dedutível (Kz)',
      ivaAPagar: 'IVA a Pagar (Kz)',
      emFalta: 'Em Falta',
      declarado: 'Declarado'
    },
    taxasUi: {
      loadError: 'Não foi possível carregar a tabela de taxas.',
      title: 'Taxas e regimes em vigor',
      subtitle: 'São estas as percentagens que os motores aplicam.',
      vatRegimes: 'Regimes de IVA',
      headerRegime: 'Regime',
      headerWhenApplies: 'Quando se aplica',
      headerHowPays: 'Como paga',
      vatRates: 'Taxas de IVA',
      headerRate: 'Taxa',
      headerOperation: 'Operação',
      headerLegalBase: 'Base legal',
      industrialTax: 'Imposto Industrial',
      headerAppliesTo: 'Aplica-se a',
      irtExemption: 'isento até',
      headerUpTo: 'Até (Kz)',
      headerFixedPart: 'Parcela fixa',
      headerOverExcess: 'Sobre o excesso de',
      above: 'acima',
      groupB: 'Grupo B (prestadores)',
      otherRates: 'Outras taxas',
      headerDescription: 'Descrição',
      socialSecurityEmployer: 'Segurança Social — entidade patronal',
      socialSecurityWorker: 'Segurança Social — trabalhador, retido no salário',
      withholdingServices: 'Retenção na fonte sobre prestações de serviço',
      propertyTaxRents: 'Imposto Predial sobre rendas',
      ofRent: 'da renda',
      stampTaxReceipts: 'Imposto do Selo sobre quitações não sujeitas a IVA'
    },
    regrasUi: {
      loadError: 'Não foi possível carregar as regras.',
      stateActive: 'Activa',
      statePending: 'Por validar',
      stateRejected: 'Rejeitada',
      enabledAlerts: 'passou a gerar alertas.',
      disabledAlerts: 'deixou de gerar alertas.',
      title: 'Regras de auditoria',
      subtitle: 'Só as regras activas geram alertas.',
      tabPending: 'Por validar',
      tabActive: 'Activas',
      tabAll: 'Todas',
      noRulesInState: 'Nenhuma regra neste estado.',
      btnActivate: 'Activar',
      btnDeactivate: 'Desactivar'
    }
  },
  en: {
    confrontoUi: {
      headerTitle: 'Accounting vs AGT Tax Portal Confrontation',
      headerSubtitle: 'Intelligent 3-step audit: upload the Trial Balance and Form 7 to verify figures and tax balances.',
      tabAiAudit: '1. AI Confrontation',
      tabAnnualConsolidation: '2. Annual Consolidation (12 Months)',
      tabHistory: '3. History',
      pillStep1: '1. Upload Trial Balance & Form 7',
      pillStep2: '2. Run AI Confrontation',
      pillStep3: '3. Numerical Cards, Excel & PDF',
      box1Header: '1. Trial Balance (PGC Accounting)',
      box2Header: '2. AGT Form 7 VAT Declaration',
      dropzonePrompt: 'Click or drag files here',
      dropzoneFormats: 'Supported formats: PDF, XLS, XLSX, CSV (up to 15MB)',
      selectFromArchive: 'Use document already in archive',
      uploadNewFile: 'Upload new file',
      selectFilePrompt: 'Select a file...',
      btnRunAudit: 'Execute Confrontation with Artificial Intelligence',
      runningAudit: 'Cross-checking documents with Artificial Intelligence...',
      step3Done: '✓ Step 3 Completed',
      step3Title: 'Numerical Tax Confrontation Dashboard',
      langLabel: 'Language:',
      btnExportExcel: 'Export Excel (.xlsx)',
      btnPrintPdf: 'Print / PDF',
      btnNewConfronto: 'New Confrontation',
      downloading: 'Downloading...',
      kpiCompliance: 'COMPLIANCE INDEX',
      kpiDivergences: 'DEVIATIONS IN KWANZAS',
      kpiPgcBalances: 'PGC 34.5 ACCOUNT BALANCES',
      cardVendas: '(SALES OR SERVICES)',
      cardCompras: '(PURCHASES OR EXPENSES)',
      cardApuramento: 'VAT ASSESSMENT',
      incidenciaVendas: 'Incidence (Sales Tax Base)',
      incidenciaCompras: 'Incidence (Purchases Tax Base)',
      ivaLiquidado14: '(+) 1. Output VAT Assessed (14%)',
      ivaDedutivel: '(-) 2. Input VAT Deductible',
      baseDifference: 'Base Difference:',
      contabBalancete: 'Accounting (Trial Balance):',
      modelo7Agt: 'AGT Form 7:',
      confrontoPeriodo: 'Period Assessment:',
      ivaAPagar: 'VAT PAYABLE TO THE STATE',
      ivaRecuperar: 'VAT CREDIT (TO RECOVER)',
      ivaReembolso: 'VAT REFUND REQUESTED',
      differenceTax: 'VAT Difference:',
      statusFullMatch: 'Full Compliance / Match',
      statusTaxDivergence: 'Tax Divergence',
      rubricsSectionTitle: 'Detailed Reconciliation Rubrics',
      rubricsSectionSubtitle: 'Line-by-line confrontation between Trial Balance and Form 7',
      historyTitle: 'Historical Confrontation Reports',
      emptyHistory: 'No confrontation records in history',
      openReport: 'Open Report',
      rawOpinionToggle: 'View Full Expert Opinion (AI Text)',
      rawOpinionTitle: 'Expert Tax Audit & Confrontation Opinion',
      viewCards: 'View Numerical Cards Mode'
    },
    consolidacaoUi: {
      fiscalYear: 'Fiscal Year:',
      exportExcel: 'Export Annual Excel (.xlsx)',
      loadingTitle: 'Consolidating 12 months of VAT and Closing Trial Balance...',
      loadingSubtitle: 'Determining cumulative revenue, reconciling deductions, and preparing Industrial Tax Form 1.',
      kpiVolumeIva: 'VAT TURNOVER (12M)',
      kpiProveitosContab: 'ACCOUNTING REVENUES',
      kpiDiferencaAnual: 'ANNUAL RECONCILIATION DIFFERENCE',
      kpiEstimativaII: 'ESTIMATED INDUSTRIAL TAX',
      of12MonthsDeclared: 'of 12 months declared',
      closingTrialBalanceCl6: 'Closing Trial Balance (Class 6)',
      deliveryUntil: 'Filing deadline',
      quadroComparativo: '1. Annual Comparative Table: Accounting vs AGT',
      rubricaFiscal: 'Tax Rubric / Base',
      contabBalanceteFecho: 'Accounting (Closing Trial Balance)',
      agtSoma12: 'AGT (Sum of 12 Forms 7)',
      status: 'Status',
      diferenca: 'Difference',
      detalheMesAMes: '2. Month-by-Month Detailed Schedule',
      totalDeclarado: 'Total Declared:',
      mes: 'Month',
      declarationNum: 'Declaration No.',
      volNegocios: 'Turnover (Kz)',
      ivaLiquidado: 'Output VAT (Kz)',
      ivaDedutivel: 'Input VAT (Kz)',
      ivaAPagar: 'VAT Payable (Kz)',
      emFalta: 'Missing',
      declarado: 'Declared'
    },
    taxasUi: {
      loadError: 'Could not load tax rates table.',
      title: 'Current Tax Rates & Regimes',
      subtitle: 'These are the official rates applied by the audit engines.',
      vatRegimes: 'VAT Regimes',
      headerRegime: 'Regime',
      headerWhenApplies: 'When It Applies',
      headerHowPays: 'Payment Method',
      vatRates: 'VAT Rates',
      headerRate: 'Rate',
      headerOperation: 'Operation',
      headerLegalBase: 'Legal Basis',
      industrialTax: 'Industrial Tax (Corporate Income Tax)',
      headerAppliesTo: 'Applies To',
      irtExemption: 'exempt up to',
      headerUpTo: 'Up to (Kz)',
      headerFixedPart: 'Fixed Amount',
      headerOverExcess: 'On Excess Above',
      above: 'above',
      groupB: 'Group B (Service Providers)',
      otherRates: 'Other Rates & Levies',
      headerDescription: 'Description',
      socialSecurityEmployer: 'Social Security — Employer Contribution',
      socialSecurityWorker: 'Social Security — Employee Withholding',
      withholdingServices: 'Withholding Tax on Service Fees',
      propertyTaxRents: 'Property Tax on Rental Income',
      ofRent: 'of rental value',
      stampTaxReceipts: 'Stamp Duty on Receipts Not Subject to VAT'
    },
    regrasUi: {
      loadError: 'Could not load audit rules.',
      stateActive: 'Active',
      statePending: 'Pending Validation',
      stateRejected: 'Rejected',
      enabledAlerts: 'is now generating alerts.',
      disabledAlerts: 'no longer generates alerts.',
      title: 'Audit Rules',
      subtitle: 'Only active rules generate alerts in the engine.',
      tabPending: 'Pending Validation',
      tabActive: 'Active',
      tabAll: 'All',
      noRulesInState: 'No rules in this status.',
      btnActivate: 'Activate',
      btnDeactivate: 'Deactivate'
    }
  },
  zh: {
    confrontoUi: {
      headerTitle: '会计账目与AGT税务局申报对账',
      headerSubtitle: '三步智能化对账审计：上传试算平衡表与Modelo 7纳税申报表，核算税款与账目余额。',
      tabAiAudit: '1. AI智能对账',
      tabAnnualConsolidation: '2. 年度汇总对账 (12个月)',
      tabHistory: '3. 历史对账记录',
      pillStep1: '1. 上传试算平衡表与Modelo 7',
      pillStep2: '2. AI智能核对',
      pillStep3: '3. 数值卡片、Excel与PDF',
      box1Header: '1. 会计试算平衡表 (PGC)',
      box2Header: '2. AGT税务局Modelo 7申报表',
      dropzonePrompt: '点击或拖拽文件至此区域',
      dropzoneFormats: '支持格式：PDF、XLS、XLSX、CSV (最大15MB)',
      selectFromArchive: '使用已归档文件',
      uploadNewFile: '上传新文件',
      selectFilePrompt: '选择文件...',
      btnRunAudit: '执行AI智能对账审计',
      runningAudit: 'AI智能对账引擎正在核对两份文件...',
      step3Done: '✓ 步骤3 已完成',
      step3Title: '对账结果与税务审计数值看板',
      langLabel: '语言：',
      btnExportExcel: '导出Excel表格 (.xlsx)',
      btnPrintPdf: '打印 / 生成PDF',
      btnNewConfronto: '新建对账',
      downloading: '正在下载...',
      kpiCompliance: '税务合规率',
      kpiDivergences: '差异金额 (宽扎)',
      kpiPgcBalances: 'PGC 34.5科目余额',
      cardVendas: '(销售与服务收入)',
      cardCompras: '(采购与成本费用)',
      cardApuramento: '增值税清算结果',
      incidenciaVendas: '计税基础 (销售额)',
      incidenciaCompras: '计税基础 (采购额)',
      ivaLiquidado14: '(+) 1. 销项增值税 (14%)',
      ivaDedutivel: '(-) 2. 进项可抵扣增值税',
      baseDifference: '计税基数差异：',
      contabBalancete: '会计账目 (试算平衡表)：',
      modelo7Agt: '税务申报 (Modelo 7)：',
      confrontoPeriodo: '本期增值税清算：',
      ivaAPagar: '应向国家缴纳增值税',
      ivaRecuperar: '可留抵税额 (留抵退税)',
      ivaReembolso: '已申请退税款',
      differenceTax: '税额差异：',
      statusFullMatch: '完全一致 / 合规',
      statusTaxDivergence: '存在税务差异',
      rubricsSectionTitle: '对账科目明细对照',
      rubricsSectionSubtitle: '试算平衡表与Modelo 7逐项对照比对',
      historyTitle: '已生成的对账审计报告',
      emptyHistory: '暂无历史对账记录',
      openReport: '查看报告',
      rawOpinionToggle: '查看完整AI专业审计鉴定意见 (文字版)',
      rawOpinionTitle: '税务与会计对账专业鉴定意见书',
      viewCards: '查看数值卡片模式'
    },
    consolidacaoUi: {
      fiscalYear: '会计年度：',
      exportExcel: '导出年度Excel表 (.xlsx)',
      loadingTitle: '正在汇总12个月增值税与年终试算平衡表...',
      loadingSubtitle: '正在统计累计营业额、核对税收抵扣并生成工业税Modelo 1申报预备数据。',
      kpiVolumeIva: '12个月增值税营业额',
      kpiProveitosContab: '会计账面总收入',
      kpiDiferencaAnual: '年度核算差异额',
      kpiEstimativaII: '预估工业所得税',
      of12MonthsDeclared: '已申报月份 / 12个月',
      closingTrialBalanceCl6: '年终试算平衡表 (第6类科目)',
      deliveryUntil: '申报截止日期',
      quadroComparativo: '1. 会计账目与AGT年度对比表',
      rubricaFiscal: '税务项目 / 计税基础',
      contabBalanceteFecho: '会计账目 (年终结账试算平衡表)',
      agtSoma12: 'AGT税务局 (12个月申报合计)',
      status: '状态',
      diferenca: '差异额',
      detalheMesAMes: '2. 全年逐月申报明细表',
      totalDeclarado: '申报总额：',
      mes: '月份',
      declarationNum: '申报表编号',
      volNegocios: '营业额 (宽扎)',
      ivaLiquidado: '销项税额 (宽扎)',
      ivaDedutivel: '进项税额 (宽扎)',
      ivaAPagar: '应缴税额 (宽扎)',
      emFalta: '未申报',
      declarado: '已申报'
    },
    taxasUi: {
      loadError: '无法加载税率表。',
      title: '现行法定税率与征管制度',
      subtitle: '以下为系统审核引擎执行的法定税率标准。',
      vatRegimes: '增值税制度',
      headerRegime: '税制类别',
      headerWhenApplies: '适用范围',
      headerHowPays: '缴纳方式',
      vatRates: '增值税法定税率',
      headerRate: '税率',
      headerOperation: '业务操作',
      headerLegalBase: '法律依据',
      industrialTax: '工业税 (企业所得税)',
      headerAppliesTo: '适用行业/对象',
      irtExemption: '起征点/免税额',
      headerUpTo: '上限 (宽扎)',
      headerFixedPart: '速算扣除数',
      headerOverExcess: '超出部分按',
      above: '以上',
      groupB: 'B组 (自由职业/劳务提供者)',
      otherRates: '其他税费与代扣代缴',
      headerDescription: '税目说明',
      socialSecurityEmployer: '社会保障金 — 雇主缴纳部分',
      socialSecurityWorker: '社会保障金 — 员工扣缴部分',
      withholdingServices: '服务费预扣所得税 (代扣代缴)',
      propertyTaxRents: '租赁房产税',
      ofRent: '租金收入之',
      stampTaxReceipts: '不征增值税收据印花税'
    },
    regrasUi: {
      loadError: '无法加载审计规则。',
      stateActive: '已生效',
      statePending: '待审核确认',
      stateRejected: '已停用',
      enabledAlerts: '已启用并开始生成风险预警。',
      disabledAlerts: '已停用且不再生成预警。',
      title: '审计合规规则库',
      subtitle: '仅处于已生效状态的规则会触发系统风险预警。',
      tabPending: '待审核',
      tabActive: '生效中',
      tabAll: '全部规则',
      noRulesInState: '该状态下无任何规则。',
      btnActivate: '启用',
      btnDeactivate: '停用'
    }
  }
};

deepMerge(pt, confrontoTranslations.pt);
deepMerge(en, confrontoTranslations.en);
deepMerge(zh, confrontoTranslations.zh);

// 3. Operational Keys from extracted JSON (lancamentosUi, documentosUi, facturasUi)
const extractedPath = path.join(ROOT, 'scripts/extracted_operational.json');
if (fs.existsSync(extractedPath)) {
  const ext = JSON.parse(fs.readFileSync(extractedPath, 'utf8'));
  const allExtracted = Object.assign({}, ext.lanc, ext.docs, ext.fact);
  
  // Translation dictionary for common accounting & operational phrases
  const ptToEnMap = {
    'Aquisição de mercadorias c/ IVA dedutível': 'Purchase of goods with deductible VAT',
    'Mercadorias': 'Merchandise / Goods',
    'Valor base da compra': 'Purchase base taxable amount',
    'IVA - Suportado / Dedutível Operações Gerais': 'VAT - Input / Deductible General Operations',
    'IVA 14%': 'VAT 14%',
    'Fornecedores Nacionais - Conta Corrente': 'National Suppliers - Current Account',
    'Total faturado pelo fornecedor': 'Total invoiced by supplier',
    'Prestação de serviços / Venda com IVA liquidado': 'Provision of services / Sale with output VAT',
    'Clientes Nacionais - Conta Corrente': 'National Customers - Current Account',
    'Total a receber do cliente': 'Total receivable from customer',
    'Vendas de Mercadorias': 'Sales of Merchandise',
    'Receita líquida de vendas': 'Net sales revenue',
    'IVA - Liquidado Operações Gerais': 'VAT - Output / Assessed General Operations',
    'Processamento de Salários c/ IRT e INSS': 'Payroll processing with PIT (IRT) and Social Security (INSS)',
    'Ordenados e Salários': 'Wages and Salaries',
    'Custo bruto com remunerações': 'Gross remuneration expense',
    'Estado - IRT Retido na Fonte': 'State - PIT (IRT) Withholding',
    'Retenção na fonte de IRT': 'PIT (IRT) tax withheld',
    'Estado - Segurança Social (INSS 3%)': 'State - Social Security (INSS 3%)',
    'Desconto trabalhador (3%)': 'Worker deduction (3%)',
    'Pessoal - Remunerações a Pagar': 'Personnel - Remuneration Payable',
    'Valor líquido a transferir': 'Net payable to employees',
    'Erro ao carregar dados da contabilidade.': 'Error loading accounting data.',
    'Por favor selecione um ficheiro para arquivar.': 'Please select a file to archive.',
    'Empresa pré-cadastrada automaticamente com sucesso!': 'Company automatically pre-registered successfully!',
    'Documento arquivado com sucesso no repositório!': 'Document archived successfully in repository!',
    'Já existe um documento com este nome para este período.': 'A document with this name already exists for this period.',
    'Ficheiro não disponível para descarregar.': 'File not available for download.',
    'Ficheiro não disponível para visualização.': 'File not available for preview.',
    'Não foi possível carregar as facturas.': 'Could not load invoices.',
    'Fatura processada com sucesso!': 'Invoice processed successfully!',
    'Falha ao processar fatura com IA.': 'Failed to process invoice with AI.',
    'Fatura escriturada no Diário de Compras!': 'Invoice booked in Purchase Journal!',
    'Sem divergências fiscais detetadas': 'No tax divergences detected',
    'Todos os valores declarados no Modelo 7 da AGT coincidem com os registos apurados no Balancete de Verificação da Contabilidade.': 'All values declared in AGT Form 7 match the figures in the Accounting Trial Balance.'
  };

  const ptToZhMap = {
    'Aquisição de mercadorias c/ IVA dedutível': '采购商品并核算可抵扣增值税',
    'Mercadorias': '库存商品',
    'Valor base da compra': '采购不含税基数金额',
    'IVA - Suportado / Dedutível Operações Gerais': '应交增值税 - 进项税额 (一般业务)',
    'IVA 14%': '增值税 14%',
    'Fornecedores Nacionais - Conta Corrente': '国内应付账款 - 往来款',
    'Total faturado pelo fornecedor': '供应商开票含税总额',
    'Prestação de serviços / Venda com IVA liquidado': '提供服务/销售商品并计提销项增值税',
    'Clientes Nacionais - Conta Corrente': '国内应收账款 - 往来款',
    'Total a receber do cliente': '应收客户含税总额',
    'Vendas de Mercadorias': '主营业务收入 - 商品销售',
    'Receita líquida de vendas': '净销售收入',
    'IVA - Liquidado Operações Gerais': '应交增值税 - 销项税额 (一般业务)',
    'Processamento de Salários c/ IRT e INSS': '计提并核算工资薪酬 (含个税IRT与社保INSS)',
    'Ordenados e Salários': '应付职工薪酬 - 工资',
    'Custo bruto com remunerações': '薪酬成本总额',
    'Estado - IRT Retido na Fonte': '应交税费 - 代扣个人所得税 (IRT)',
    'Retenção na fonte de IRT': '代扣个税IRT',
    'Estado - Segurança Social (INSS 3%)': '其他应付款 - 个人社保代扣 (INSS 3%)',
    'Desconto trabalhador (3%)': '个人扣缴社保3%',
    'Pessoal - Remunerações a Pagar': '应付职工薪酬 - 实发净额',
    'Valor líquido a transferir': '实发工资转账金额',
    'Erro ao carregar dados da contabilidade.': '加载会计数据时出错。',
    'Por favor selecione um ficheiro para arquivar.': '请选择需要归档的文件。',
    'Empresa pré-cadastrada automaticamente com sucesso!': '企业已自动完成预登记！',
    'Documento arquivado com sucesso no repositório!': '文件已成功归档至资料库！',
    'Já existe um documento com este nome para este período.': '该期间已存在同名归档文件。',
    'Ficheiro não disponível para descarregar.': '文件无法下载。',
    'Ficheiro não disponível para visualização.': '文件无法在线预览。',
    'Não foi possível carregar as facturas.': '无法加载发票列表。',
    'Fatura processada com sucesso!': '发票处理成功！',
    'Falha ao processar fatura com IA.': 'AI智能处理发票失败。',
    'Fatura escriturada no Diário de Compras!': '发票已成功过账至采购日记账！',
    'Sem divergências fiscais detetadas': '未检测到任何税务差异',
    'Todos os valores declarados no Modelo 7 da AGT coincidem com os registos apurados no Balancete de Verificação da Contabilidade.': 'AGT税务局Modelo 7申报的所有数值与会计试算平衡表记录完全一致。'
  };

  function setLeaf(targetObj, dotPath, value) {
    const parts = dotPath.split('.');
    let curr = targetObj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!curr[parts[i]] || typeof curr[parts[i]] !== 'object') {
        curr[parts[i]] = {};
      }
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = value;
  }

  function getLeaf(targetObj, dotPath) {
    const parts = dotPath.split('.');
    let curr = targetObj;
    for (const p of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[p];
    }
    return curr;
  }

  for (const [k, defVal] of Object.entries(allExtracted)) {
    if (!defVal) continue;
    // Set in PT if not exists
    if (getLeaf(pt, k) === undefined) {
      setLeaf(pt, k, defVal);
    }
    // Set in EN
    if (getLeaf(en, k) === undefined) {
      const enVal = ptToEnMap[defVal] || defVal;
      setLeaf(en, k, enVal);
    }
    // Set in ZH
    if (getLeaf(zh, k) === undefined) {
      const zhVal = ptToZhMap[defVal] || ptToEnMap[defVal] || defVal;
      setLeaf(zh, k, zhVal);
    }
  }
}

// 4. Official Report keys
if (!pt.officialReport) pt.officialReport = {};
if (!en.officialReport) en.officialReport = {};
if (!zh.officialReport) zh.officialReport = {};

pt.officialReport.allCompliant = 'Sem divergências fiscais detetadas';
pt.officialReport.allCompliantDesc = 'Todos os valores declarados no Modelo 7 da AGT coincidem com os registos apurados no Balancete de Verificação da Contabilidade.';

en.officialReport.allCompliant = 'No tax divergences detected';
en.officialReport.allCompliantDesc = 'All values declared in AGT Form 7 match the figures in the Accounting Trial Balance.';

zh.officialReport.allCompliant = '未检测到任何税务差异';
zh.officialReport.allCompliantDesc = 'AGT税务局Modelo 7申报的所有数值与会计试算平衡表记录完全一致。';

// 5. Explicit missing 30 keys with interpolations and exact terminology
const extraLeaves = [
  ['lancamentosUi.unbalancedEntryError', 'Lançamento desbalanceado: Débito ({{debito}} Kz) ≠ Crédito ({{credito}} Kz). Diferença: {{diferenca}} Kz.', 'Unbalanced journal entry: Debit ({{debito}} Kz) ≠ Credit ({{credito}} Kz). Difference: {{diferenca}} Kz.', '分录借贷不平：借方 ({{debito}} Kz) ≠ 贷方 ({{credito}} Kz)。差额：{{diferenca}} Kz。'],
  ['lancamentosUi.journalPeriodCount', '{{count}} Lançamentos no Período {{mes}}/{{ano}}', '{{count}} Journal Entries in Period {{mes}}/{{ano}}', '期间 {{mes}}/{{ano}} 共有 {{count}} 笔会计分录'],
  ['lancamentosUi.trialBalanceTitle', 'Balancete de Verificação Oficial do Exercício ({{mes}}/{{ano}})', 'Official Trial Balance of the Exercise ({{mes}}/{{ano}})', '官方试算平衡表 ({{mes}}/{{ano}})'],
  ['lancamentosUi.trialBalanceSubtitle', 'Plano Geral de Contabilidade (Decreto n.º 82/01) — {{count}} contas com saldo ou movimento', 'General Accounting Plan (Decree No. 82/01) — {{count}} accounts with balance or activity', '总会计科目表 (第82/01号法令) — 共有 {{count}} 个发生额或余额科目'],
  ['lancamentosUi.equationUnbalanced', '⚠ Desbalanceado ({{diff}} Kz)', '⚠ Unbalanced ({{diff}} Kz)', '⚠ 借贷不平衡 ({{diff}} Kz)'],
  ['common.saveError', 'Erro ao guardar alterações.', 'Error saving changes.', '保存修改时出错。'],
  ['legislacao.title', 'Legislação Fiscal & Códigos Tributários de Angola', 'Angolan Tax Legislation & Fiscal Codes', '安哥拉税收法规与法定税法典'],
  ['admin.pgc.loadError', 'Erro ao carregar dados do Plano Geral de Contabilidade.', 'Error loading General Accounting Plan data.', '加载总会计科目表数据时出错。'],
  ['admin.pgc.exportExcelSuccess', 'Download do PGC em Excel (.xlsx) concluído com sucesso!', 'PGC Excel (.xlsx) download completed successfully!', 'PGC总会计科目表Excel (.xlsx)下载成功！'],
  ['admin.pgc.exportExcelError', 'Erro ao transferir ficheiro Excel do PGC.', 'Error downloading PGC Excel file.', '下载PGC总会计科目表Excel文件时出错。'],
  ['configuracoes.companyRequired', 'A Razão Social e o NIF da empresa são obrigatórios.', 'Company Legal Name and Tax ID (NIF) are required.', '企业法定名称与税号(NIF)为必填项。'],
  ['configuracoes.companySaved', 'Dados da empresa guardados com sucesso!', 'Company information saved successfully!', '企业资料保存成功！'],
  ['configuracoes.companySaveError', 'Não foi possível guardar os dados da empresa.', 'Could not save company information.', '无法保存企业资料。'],
  ['configuracoes.usernameRequired', 'O nome de utilizador não pode ficar vazio.', 'Username cannot be empty.', '用户名不能为空。'],
  ['configuracoes.currentPassRequired', 'Informe a sua palavra-passe atual para definir uma nova palavra-passe.', 'Please provide your current password to set a new password.', '设置新密码前请输入当前旧密码。'],
  ['configuracoes.toastSavedWithPass', 'Perfil e palavra-passe atualizados com sucesso!', 'Profile and password updated successfully!', '个人资料与密码已成功更新！'],
  ['configuracoes.toastSaveError', 'Erro ao atualizar o perfil no servidor.', 'Error updating profile on the server.', '在服务器更新个人资料时出错。'],
  ['documentosUi.newCompanyPreRegisteredToast', 'Nova empresa pré-cadastrada automaticamente: {{nome}} (NIF: {{nif}})', 'New company automatically pre-registered: {{nome}} (Tax ID: {{nif}})', '已自动完成新企业预登记：{{nome}} (税号: {{nif}})'],
  ['documentosUi.yearPrefix', 'Ano {{year}}', 'Year {{year}}', '{{year}}年度'],
  ['documentosUi.thArchivedDoc', 'Documento Arquivado ({{count}})', 'Archived Document ({{count}})', '已归档文件 ({{count}})'],
  ['facturasUi.operatorBannerTitle', 'Portal do Operador de Facturação — Olá, {{name}}', 'Invoice Operator Portal — Hello, {{name}}', '发票录入员工作台 — 你好，{{name}}'],
  ['facturasUi.postedInJournalCount', '{{count}} escrituradas no diário', '{{count}} posted to journal', '{{count}} 笔已过账至日记账'],
  ['facturasUi.registeredInvoicesHeader', 'Facturas Registadas & Auditadas ({{count}})', 'Registered & Audited Invoices ({{count}})', '已登记与审核发票 ({{count}})'],
  ['facturasUi.activeCompanyBadge', 'Empresa Ativa: {{nome}} (NIF: {{nif}})', 'Active Company: {{nome}} (Tax ID: {{nif}})', '当前生效企业：{{nome}} (税号: {{nif}})'],
  ['facturasUi.invoiceNumTitle', 'Factura N.º {{num}}', 'Invoice No. {{num}}', '发票号码：{{num}}'],
  ['facturasUi.originalPhotoCaptured', 'Foto Original Capturada ({{name}})', 'Captured Original Photo ({{name}})', '拍摄的原始发票照片 ({{name}})'],
  ['facturasUi.nifMatchesActiveCompany', 'NIF coincide com a empresa ativa ({{nome}})', 'Tax ID matches active company ({{nome}})', '税号与当前生效企业一致 ({{nome}})'],
  ['facturasUi.nifDiffersActiveCompany', 'NIF da fatura ({{clienteNif}}) difere da empresa ativa ({{empresaNif}})', 'Invoice Tax ID ({{clienteNif}}) differs from active company ({{empresaNif}})', '发票税号 ({{clienteNif}}) 与当前生效企业税号 ({{empresaNif}}) 不一致'],
  ['facturasUi.invoiceItemsHeader', 'ARTIGOS & LINHAS DA FACTURA ({{count}})', 'INVOICE ITEMS & LINES ({{count}})', '发票商品明细与行项目 ({{count}})'],
  ['facturasUi.vatWithRateCaps', 'IVA ({{rate}}%)', 'VAT ({{rate}}%)', '增值税 ({{rate}}%)']
];

for (const [key, ptV, enV, zhV] of extraLeaves) {
  setLeaf(pt, key, ptV);
  setLeaf(en, key, enV);
  setLeaf(zh, key, zhV);
}

// Save all 3 locale files
fs.writeFileSync(PT_PATH, JSON.stringify(pt, null, 2), 'utf8');
fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 2), 'utf8');
fs.writeFileSync(ZH_PATH, JSON.stringify(zh, null, 2), 'utf8');

console.log('pt.json, en.json, zh.json updated successfully!');
