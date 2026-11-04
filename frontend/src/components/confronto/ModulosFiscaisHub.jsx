import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { authHeaders, API_BASE } from '../../services/api';

const MODULOS_CONFIG = [
  {
    id: 'IVA',
    codigo: 'M1',
    nome: 'IVA — Imposto sobre o Valor Acrescentado',
    sigla: 'CIVA · Modelo 7',
    periodicidade: 'Mensal',
    status: 'OPERACIONAL',
    descricao: 'Confronto entre Balancete PGC (Contas 61/62, 21, 752, 34.5) e Declaração Modelo 7 da AGT.',
    documentos: [
      { tipo: 'BALANCETE', nome: 'Balancete de Verificação Analítico (PGC)', obrigatorio: true },
      { tipo: 'MODELO7', nome: 'Declaração Modelo 7 da AGT (Comprovativo de Liquidação)', obrigatorio: true },
      { tipo: 'FACTURA_VENDA', nome: 'Ficheiro SAF-T de Facturação / Vendas', obrigatorio: false },
    ],
    roteiroConsultoria: [
      { titulo: 'Triangulação de Base Tributável', detalhe: 'Confrontar Vendas/Serviços (Contas 61/62) com Quadro 09 (Campos 1/1.2) do Modelo 7.' },
      { titulo: 'Incidência de Compras e FSE', detalhe: 'Auditar Compras de Existências (Conta 21 vs Campo 18) e Despesas FSE (Conta 752 vs Campo 22).' },
      { titulo: 'Apuramento do IVA (Lei n.º 7/19)', detalhe: 'Validar IVA Liquidado (Conta 34.5.3) − IVA Dedutível (Conta 34.5.1/2) = IVA a Pagar (Conta 34.5.6.1) ou Crédito Fiscal a Recuperar (Conta 34.5.7.1).' },
      { titulo: 'Prazo Legal da AGT', detalhe: 'Submissão e pagamento obrigatórios até ao último dia do mês seguinte.' }
    ]
  },
  {
    id: 'IRT',
    codigo: 'M2',
    nome: 'IRT — Imposto sobre o Rendimento do Trabalho',
    sigla: 'Grupo A / Grupo B · Lei n.º 28/20',
    periodicidade: 'Mensal',
    status: 'PENDENTE',
    descricao: 'Auditoria das remunerações (Conta 72) vs Folha Salarial vs Conta 34.2 vs Declaração Modelo 2 e DAR pago.',
    documentos: [
      { tipo: 'FOLHA_SALARIAL', nome: 'Folha de Salários / Mapa de Remunerações Detalhado', obrigatorio: true },
      { tipo: 'DECLARACAO_IRT', nome: 'Declaração Modelo 2 da AGT (Relação Nominal)', obrigatorio: true },
      { tipo: 'COMPROVATIVOS', nome: 'Comprovativo DAR de Liquidação de IRT Pago', obrigatorio: true },
      { tipo: 'BALANCETE', nome: 'Balancete PGC (Contas 72.1, 72.2 e 34.2)', obrigatorio: true },
    ],
    roteiroConsultoria: [
      {
        titulo: 'Por que a Folha Salarial é Obrigatória?',
        detalhe: 'O Balancete só tem totais agregados. O IRT (Grupo A) é progressivo por escalões (0% a 25%). Apenas a Folha permite auditar quem ganha quanto e se as taxas foram calculadas corretamente.'
      },
      {
        titulo: 'Auditoria de Subsídios Isentos (Lei 28/20)',
        detalhe: 'Verificar subsídios de alimentação e transporte. O teto legal de isenção é de 30.000 Kz/mês por trabalhador. Todo o excesso integra a matéria coletável e tem de pagar IRT.'
      },
      {
        titulo: 'Dedução Legal da Segurança Social (3%)',
        detalhe: 'Validar se a contribuição do trabalhador para o INSS (3%) foi deduzida antes da aplicação da tabela de retenção do IRT.'
      },
      {
        titulo: 'Triangulação Contabilística e Fiscal',
        detalhe: 'Confrontar: [Total IRT da Folha] == [Crédito na Conta 34.2 do PGC] == [Valor Pago no DAR da AGT]. Se houver diferença, há risco de coima de 25% a 200% do imposto devido.'
      },
      {
        titulo: 'Prazo Legal da AGT',
        detalhe: 'Entrega da declaração e pagamento via DAR até ao último dia útil do mês seguinte (Código do IRT).'
      }
    ]
  },
  {
    id: 'II',
    codigo: 'M3',
    nome: 'Imposto Industrial — Lucro Tributável & Modelo 1',
    sigla: 'Regime Geral / Simplificado · Lei n.º 19/14',
    periodicidade: 'Anual & Provisório',
    status: 'PENDENTE',
    descricao: 'Reconciliação entre o Lucro Contabilístico e o Lucro Tributável, ajustamentos fiscais e deduções de retenções sofridas.',
    documentos: [
      { tipo: 'IMPOSTO_INDUSTRIAL', nome: 'Declaração Modelo 1 da AGT com Anexos A, B, C e D', obrigatorio: true },
      { tipo: 'BALANCETE', nome: 'Balanço Patrimonial e DRE (Demonstração de Resultados)', obrigatorio: true },
      { tipo: 'COMPROVATIVOS', nome: 'DAR de Liquidação Provisória (Agosto) e Definitiva (Maio)', obrigatorio: true },
      { tipo: 'RETENCOES', nome: 'Certificados de Retenções na Fonte de 6,5% Sofridas de Clientes', obrigatorio: false },
    ],
    roteiroConsultoria: [
      {
        titulo: 'Ajustamentos Fiscais do Anexo A',
        detalhe: 'Acrescentar ao lucro contabilístico os custos não aceites fiscalmente: despesas sem factura com NIF, multas fiscais (Conta 756/757), amortizações além da tabela oficial e 50% das doações.'
      },
      {
        titulo: 'Dedução de Retenções Sofridas (6,5%)',
        detalhe: 'Conferir o saldo da Conta 34.1.3 (Retenções na Fonte de Clientes) para abater diretamente no valor final do imposto a pagar.'
      },
      {
        titulo: 'Taxa Geral e Prazos',
        detalhe: 'Taxa geral de 25% (ou 35% no setor bancário). Liquidação provisória em Agosto sobre o volume de negócios do 1.º semestre e liquidação definitiva em Maio do ano seguinte.'
      }
    ]
  },
  {
    id: 'RETENCOES',
    codigo: 'M4',
    nome: 'Retenções na Fonte — Serviços (6,5%) & Mercadorias (2%)',
    sigla: 'Art. 67.º do Código do Imposto Industrial',
    periodicidade: 'Mensal',
    status: 'PENDENTE',
    descricao: 'Auditoria das retenções aplicadas aos prestadores de serviços e fornecedores de bens vs entrega à AGT.',
    documentos: [
      { tipo: 'RETENCOES', nome: 'Mapa de Facturas de Prestadores com Retenção de 6,5%', obrigatorio: true },
      { tipo: 'COMPROVATIVOS', nome: 'DAR de Retenção na Fonte Pago (Códigos 0363 / 0364)', obrigatorio: true },
      { tipo: 'BALANCETE', nome: 'Balancete PGC (Conta 34.3 - Estado: Retenções na Fonte)', obrigatorio: true },
    ],
    roteiroConsultoria: [
      {
        titulo: 'Obrigatoriedade de Reter 6,5%',
        detalhe: 'Ao pagar a prestadores de serviços, a empresa é substituta tributária e deve reter 6,5%, entregando recibo de retenção ao fornecedor.'
      },
      {
        titulo: 'Cruzamento da Conta 34.3 com o DAR',
        detalhe: 'O saldo creditado na Conta 34.3 no mês deve ser integralmente liquidado via DAR até ao último dia útil do mês seguinte.'
      },
      {
        titulo: 'Dispensa de Retenção',
        detalhe: 'Apenas fornecedores com certidão de dispensa ou regime especial emitido pela AGT estão isentos de retenção.'
      }
    ]
  },
  {
    id: 'INSS',
    codigo: 'M5',
    nome: 'Segurança Social (INSS) — 8% Patronal + 3% Trabalhador',
    sigla: 'Decreto Presidencial n.º 227/18',
    periodicidade: 'Mensal',
    status: 'PENDENTE',
    descricao: 'Confronto entre os 11% da Folha Salarial vs Conta 72.5 (Encargos 8%) e Conta 34.4 / 37.2 vs Guia Paga.',
    documentos: [
      { tipo: 'FOLHA_SS', nome: 'Guia de Pagamento das Contribuições do INSS', obrigatorio: true },
      { tipo: 'FOLHA_SALARIAL', nome: 'Folha de Salários / Mapa de Remunerações do Mês', obrigatorio: true },
      { tipo: 'COMPROVATIVOS', nome: 'Comprovativo Bancário de Pagamento ao INSS', obrigatorio: true },
      { tipo: 'BALANCETE', nome: 'Balancete PGC (Conta 72.5 Encargos Sociais e Conta 34.4/37.2)', obrigatorio: true },
    ],
    roteiroConsultoria: [
      {
        titulo: 'Regra dos 11% da Remuneração Bruta',
        detalhe: '8% suportados pela entidade empregadora (Conta 72.5) + 3% descontados ao trabalhador (Conta 34.4/37.2). Total = 11% da massa salarial sujeita.'
      },
      {
        titulo: 'Prazo Rigoroso',
        detalhe: 'Pagamento obrigatório até ao dia 10 do mês seguinte. O atraso acarreta juros de mora diários de 2,5% e bloqueio de certidões contributivas.'
      }
    ]
  },
  {
    id: 'SELO',
    codigo: 'M6',
    nome: 'Imposto do Selo — Operações & Recibos de Quitação',
    sigla: 'Código do Imposto do Selo (TGIS)',
    periodicidade: 'Mensal',
    status: 'PENDENTE',
    descricao: 'Auditoria sobre operações financeiras, recibos de quitação e contratos sujeitos à Tabela Geral do Imposto do Selo.',
    documentos: [
      { tipo: 'COMPROVATIVOS', nome: 'Recibos de Quitação / Comprovativos com Selo', obrigatorio: true },
      { tipo: 'COMPROVATIVOS', nome: 'DAR de Imposto do Selo Pago (Código 0371)', obrigatorio: true },
      { tipo: 'BALANCETE', nome: 'Balancete PGC (Conta 34.7 - Imposto do Selo)', obrigatorio: true },
    ],
    roteiroConsultoria: [
      {
        titulo: 'Recibos de Quitação e Pagamentos em Dinheiro',
        detalhe: 'Aplicação de 1% sobre recibos de quitação ou transmissões financeiras conforme TGIS.'
      },
      {
        titulo: 'Conferência da Conta 34.7',
        detalhe: 'Cruzar os saldos de selo debitados/creditados na contabilidade com as guias DAR emitidas no Portal da AGT.'
      }
    ]
  }
];

const ModulosFiscaisHub = ({
  moduloAtivo,
  onSelecionarModulo,
  empresaId,
  ano,
  mes,
  documentos = [],
  onUploadSucesso
}) => {
  const [moduloExpandido, setModuloExpandido] = useState(moduloAtivo || 'IVA');
  const [enviandoTipo, setEnviandoTipo] = useState(null);
  const fileInputRef = useRef(null);
  const [tipoUploadAlvo, setTipoUploadAlvo] = useState('');

  const handleToggleModulo = (id) => {
    const novo = moduloExpandido === id ? null : id;
    setModuloExpandido(novo);
    if (novo) onSelecionarModulo(novo);
  };

  const handleDispararUpload = (tipo) => {
    setTipoUploadAlvo(tipo);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleArquivoSelecionado = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !tipoUploadAlvo) return;

    setEnviandoTipo(tipoUploadAlvo);
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      formData.append('tipo', tipoUploadAlvo);
      formData.append('substituir', 'true');
      if (empresaId) formData.append('empresa_id', empresaId);
      if (ano) formData.append('ano', ano);
      if (mes) formData.append('mes', mes);

      const res = await fetch(`${API_BASE}/documentos/upload/`, {
        method: 'POST',
        headers: authHeaders(),
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro ao enviar ${file.name}`);
      }

      const data = await res.json();
      toast.success(`Ficheiro carregado com sucesso: ${file.name}`);
      if (onUploadSucesso) onUploadSucesso(data.documento);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Erro ao carregar documento.');
    } finally {
      setEnviandoTipo(null);
      setTipoUploadAlvo('');
    }
  };

  // Helper para verificar se um tipo de documento já existe carregado
  const docCarregado = (tipo) => {
    return documentos.find(
      (d) => d.tipo === tipo && String(d.ano) === String(ano) && String(d.mes) === String(mes)
    ) || documentos.find((d) => d.tipo === tipo);
  };

  return (
    <div className="mb-25 no-print">
      {/* Input de ficheiro oculto para uploads rápidos */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleArquivoSelecionado}
      />

      {/* CABEÇALHO DO HUB DE AUDITORIA */}
      <div
        className="d-flex justify-content-between align-items-center mb-12 flex-wrap"
        style={{ gap: 10 }}
      >
        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: '#2563eb',
              textTransform: 'uppercase',
              letterSpacing: '0.8px'
            }}
          >
            SISTEMA INTEGRADO DE AUDITORIA FISCAL & CONTABILÍSTICA (ANGOLA)
          </span>
          <h5 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '2px 0 0 0' }}>
            Módulos de Tributação Obrigatória (Selecione para ver o Roteiro & Documentos)
          </h5>
        </div>
        <span
          className="badge"
          style={{
            fontSize: '11px',
            background: '#ffffff',
            color: '#334155',
            border: '1px solid #cbd5e1',
            padding: '4px 10px',
            fontWeight: 700
          }}
        >
          {ano && mes ? `Período: ${String(mes).padStart(2, '0')}/${ano}` : 'Período Ativo'}
        </span>
      </div>

      {/* LISTA VERTICAL DE MÓDULOS (UM EM BAIXO DO OUTRO) */}
      <div className="d-flex flex-column" style={{ gap: 10 }}>
        {MODULOS_CONFIG.map((mod, idx) => {
          const isAtivo = moduloAtivo === mod.id;
          const isExpandido = moduloExpandido === mod.id;
          const isOperacional = mod.status === 'OPERACIONAL';

          return (
            <div
              key={mod.id}
              style={{
                background: '#ffffff',
                border: isAtivo ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: '10px',
                overflow: 'hidden',
                boxShadow: isAtivo ? '0 3px 12px rgba(37, 99, 235, 0.06)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {/* LINHA DE RESUMO DO MÓDULO (CLICÁVEL) */}
              <div
                onClick={() => handleToggleModulo(mod.id)}
                style={{
                  padding: '12px 18px',
                  cursor: 'pointer',
                  background: isAtivo ? '#ffffff' : '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10
                }}
              >
                <div className="d-flex align-items-center" style={{ gap: 12 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: isOperacional ? '#eff6ff' : '#f8fafc',
                      color: isOperacional ? '#2563eb' : '#64748b',
                      border: `1px solid ${isOperacional ? '#bfdbfe' : '#e2e8f0'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '12px'
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
                      <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>
                        {mod.nome}
                      </strong>
                      <span
                        className="badge"
                        style={{
                          fontSize: '10px',
                          background: '#ffffff',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          fontWeight: 700,
                          padding: '2px 7px'
                        }}
                      >
                        {mod.sigla}
                      </span>
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block', marginTop: '1px' }}>
                      {mod.descricao}
                    </span>
                  </div>
                </div>

                <div className="d-flex align-items-center" style={{ gap: 10 }}>
                  <span
                    className="badge"
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '4px 10px',
                      background: isOperacional ? '#dcfce7' : '#fef9c3',
                      color: isOperacional ? '#15803d' : '#854d0e',
                      border: `1px solid ${isOperacional ? '#86efac' : '#fde047'}`
                    }}
                  >
                    {isOperacional ? '✓ OPERACIONAL' : '⏳ PENDENTE'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-xs"
                    style={{
                      background: isAtivo ? '#2563eb' : '#ffffff',
                      color: isAtivo ? '#ffffff' : '#2563eb',
                      border: '1px solid #2563eb',
                      fontWeight: 700,
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: 6
                    }}
                  >
                    {isExpandido ? '▲ Recolher' : '▼ Ver Roteiro & Docs'}
                  </button>
                </div>
              </div>

              {/* PAINEL EXPANSÍVEL: DOCUMENTOS OBRIGATÓRIOS & GUIA DE CONSULTORIA */}
              {isExpandido && (
                <div
                  style={{
                    borderTop: '1px solid #e2e8f0',
                    background: '#ffffff',
                    padding: '16px 20px'
                  }}
                >
                  <div className="row" style={{ rowGap: 16 }}>
                    {/* COLUNA 1: DOCUMENTOS OBRIGATÓRIOS DO IMPOSTO */}
                    <div className="col-12 col-md-6">
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '12px 14px',
                          height: '100%'
                        }}
                      >
                        <div
                          className="d-flex justify-content-between align-items-center mb-8 pb-6"
                          style={{ borderBottom: '1px solid #f1f5f9' }}
                        >
                          <strong style={{ fontSize: '12px', color: '#1e293b', textTransform: 'uppercase' }}>
                            <i className="la la-folder-open mr-4" style={{ color: '#2563eb' }}></i>
                            Documentos Obrigatórios do Módulo
                          </strong>
                          <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                            {mod.documentos.length} Ficheiros
                          </span>
                        </div>

                        <div className="d-flex flex-column" style={{ gap: 8 }}>
                          {mod.documentos.map((doc, dIdx) => {
                            const carregado = docCarregado(doc.tipo);
                            const emEnvio = enviandoTipo === doc.tipo;

                            return (
                              <div
                                key={dIdx}
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 6,
                                  padding: '8px 10px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: 8
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div className="d-flex align-items-center" style={{ gap: 6 }}>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: '#0f172a'
                                      }}
                                    >
                                      {doc.nome}
                                    </span>
                                    {doc.obrigatorio && (
                                      <span style={{ fontSize: '9px', color: '#dc2626', fontWeight: 800 }}>
                                        *Obrigatório
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>
                                    {carregado ? `✓ Ficheiro no arquivo: ${carregado.nome_arquivo || carregado.arquivo_url || 'Disponível'}` : '⚠️ Documento em falta no período'}
                                  </span>
                                </div>

                                <div>
                                  {mod.id === 'IVA' && (doc.tipo === 'BALANCETE' || doc.tipo === 'MODELO7') ? (
                                    <span
                                      className="badge"
                                      style={{
                                        fontSize: '9.5px',
                                        background: '#ffffff',
                                        color: '#2563eb',
                                        border: '1px solid #bfdbfe',
                                        padding: '3px 8px'
                                      }}
                                    >
                                      Usar Caixa Abaixo
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn btn-xs"
                                      disabled={emEnvio}
                                      onClick={() => handleDispararUpload(doc.tipo)}
                                      style={{
                                        fontSize: '10.5px',
                                        fontWeight: 700,
                                        padding: '4px 10px',
                                        background: carregado ? '#ffffff' : '#2563eb',
                                        color: carregado ? '#2563eb' : '#ffffff',
                                        border: '1px solid #2563eb',
                                        borderRadius: 6
                                      }}
                                    >
                                      {emEnvio ? (
                                        'A enviar...'
                                      ) : carregado ? (
                                        'Substituir'
                                      ) : (
                                        '+ Subir Ficheiro'
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* COLUNA 2: ROTEIRO DE CONSULTORIA & AUDITORIA FISCAL */}
                    <div className="col-12 col-md-6">
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          padding: '12px 14px',
                          height: '100%'
                        }}
                      >
                        <div
                          className="d-flex justify-content-between align-items-center mb-8 pb-6"
                          style={{ borderBottom: '1px solid #f1f5f9' }}
                        >
                          <strong style={{ fontSize: '12px', color: '#1e293b', textTransform: 'uppercase' }}>
                            <i className="la la-clipboard-check mr-4" style={{ color: '#2563eb' }}></i>
                            O Que o Auditor Tem de Fazer para Consultoria
                          </strong>
                          <span
                            className="badge"
                            style={{
                              fontSize: '9.5px',
                              background: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe'
                            }}
                          >
                            Legislação Angolana
                          </span>
                        </div>

                        <div className="d-flex flex-column" style={{ gap: 8 }}>
                          {mod.roteiroConsultoria.map((passo, pIdx) => (
                            <div
                              key={pIdx}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: 6,
                                padding: '8px 11px'
                              }}
                            >
                              <strong style={{ fontSize: '11px', color: '#0f172a', display: 'block', marginBottom: '2px' }}>
                                {pIdx + 1}. {passo.titulo}
                              </strong>
                              <span style={{ fontSize: '10.5px', color: '#475569', lineHeight: 1.4, display: 'block' }}>
                                {passo.detalhe}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {mod.id === 'IVA' && (
                    <div
                      style={{
                        marginTop: 14,
                        padding: '10px 14px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: 8,
                        fontSize: '11.5px',
                        color: '#1e40af',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10
                      }}
                    >
                      <div>
                        <strong>Módulo do IVA Ativo:</strong> Carregue o Balancete (Caixa 1) e o Modelo 7 (Caixa 2) abaixo para efetuar o cruzamento inteligente com IA.
                      </div>
                      <span className="badge" style={{ background: '#2563eb', color: '#ffffff', fontWeight: 700, fontSize: '10.5px', padding: '4px 10px' }}>
                        Área de Confronto Abaixo ↓
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModulosFiscaisHub;
