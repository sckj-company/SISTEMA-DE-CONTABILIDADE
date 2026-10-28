import { parseAnaliseIA, isLinhaDecorativaOuRuido, isTituloDiferencaValido, sanitizarValorTexto } from '../utils/analiseIaParser';

describe('analiseIaParser - Sanitização e Robustez de Markdown', () => {
  test('isLinhaDecorativaOuRuido deve identificar linhas de ruído e separadores Markdown', () => {
    expect(isLinhaDecorativaOuRuido('*====================================*')).toBe(true);
    expect(isLinhaDecorativaOuRuido('*====================================')).toBe(true);
    expect(isLinhaDecorativaOuRuido('====================================')).toBe(true);
    expect(isLinhaDecorativaOuRuido('---')).toBe(true);
    expect(isLinhaDecorativaOuRuido('--')).toBe(true);
    expect(isLinhaDecorativaOuRuido('*')).toBe(true);
    expect(isLinhaDecorativaOuRuido('-')).toBe(true);
    expect(isLinhaDecorativaOuRuido('***')).toBe(true);
    expect(isLinhaDecorativaOuRuido('| Campo | O que está no Balancete | O que foi declarado no Modelo 7 | Causa provável | Risco fiscal |')).toBe(true);
    expect(isLinhaDecorativaOuRuido('| Nome do Campo | Contabilidade | AGT | Status | Diferença |')).toBe(true);
    expect(isLinhaDecorativaOuRuido('Para cada diferenca:')).toBe(true);
    expect(isLinhaDecorativaOuRuido('[Nome do Campo]')).toBe(true);

    // Texto real não é ruído
    expect(isLinhaDecorativaOuRuido('Base Tributável / Volume de Negócios: 100.000,00 Kz')).toBe(false);
    expect(isLinhaDecorativaOuRuido('IVA Liquidado (Conta 3453): 14.000,00 Kz')).toBe(false);
  });

  test('isTituloDiferencaValido deve rejeitar separadores e aceitar rubricas reais', () => {
    expect(isTituloDiferencaValido('*====================================')).toBe(false);
    expect(isTituloDiferencaValido('====================================')).toBe(false);
    expect(isTituloDiferencaValido('--')).toBe(false);
    expect(isTituloDiferencaValido('ANÁLISE DAS DIFERENÇAS DETETADAS')).toBe(false);
    expect(isTituloDiferencaValido('Nenhuma divergência detetada')).toBe(false);

    expect(isTituloDiferencaValido('Base Tributável / Volume de Negócios')).toBe(true);
    expect(isTituloDiferencaValido('IVA Liquidado – Divergência de 5.000,00 Kz')).toBe(true);
  });

  test('sanitizarValorTexto deve remover formatação residual e manter conteúdo substantivo', () => {
    expect(sanitizarValorTexto('- **O que está no Balancete:** 500.000,00 Kz (Conta 71)')).toBe('500.000,00 Kz (Conta 71)');
    expect(sanitizarValorTexto('* **Risco fiscal:** Elevado perante o CIVA')).toBe('Elevado perante o CIVA');
    expect(sanitizarValorTexto('*====================================')).toBe('');
    expect(sanitizarValorTexto('--')).toBe('');
  });

  test('Cenário Real do Bug da Foto: Não deve criar falsa divergência quando os valores são conformes', () => {
    const textoIaComGlitch = `
====================================
1. RESUMO DO CONFRONTO (BALANCETE vs MODELO 7)
====================================
- Documentos confrontados: Balancete de Verificação e Declaração Modelo 7
- Total de pontos analisados: 3
- Dados IGUAIS (Conformes): 3
- Dados com DIFERENCAS: 0

====================================
2. DETALHE DOS DADOS: IGUAIS vs DIFERENCAS
====================================
| Nome do Campo | Contabilidade (Balancete) | AGT (Modelo 7) | Status | Diferença Apurada |
| Base Tributável / Volume de Negócios | 10.000.000,00 Kz | 10.000.000,00 Kz | IGUAIS | 0,00 Kz |
| IVA Liquidado (Conta 3453) | 1.400.000,00 Kz | 1.400.000,00 Kz | IGUAIS | 0,00 Kz |
| IVA Dedutível (Conta 3451) | 500.000,00 Kz | 500.000,00 Kz | IGUAIS | 0,00 Kz |

====================================
3. ANALISE DAS DIFERENCAS DETETADAS
====================================
*====================================
| Campo | O que está no Balancete | O que foi declarado no Modelo 7 | Causa provável | Risco fiscal |

**Pontos IGUAIS**:
--
*====================================
*
- Base Tributável / Volume de Negócios: 10.000.000,00 Kz (em perfeita conformidade)
- IVA Liquidado (Conta 3453): 1.400.000,00 Kz (em perfeita conformidade)
- IVA Dedutível (Conta 3451): 500.000,00 Kz (em perfeita conformidade)

====================================
4. O QUE FAZER PARA RESOLVER (RECOMENDACOES)
====================================
1. **Manter o Arquivo Digital Atualizado**
   - Manter as faturas e guias de liquidação arquivadas.
2. **Reconciliação Mensal Contínua**
   - Efetuar o fecho mensal antes do dia 25.

**Resultado esperado**:
- Plena conformidade fiscal perante a AGT.
`;

    const resultado = parseAnaliseIA(textoIaComGlitch);

    expect(resultado).not.toBeNull();
    expect(resultado.totalPontos).toBe(3);
    expect(resultado.iguaisCount).toBe(3);
    expect(resultado.diferencasCount).toBe(0);

    // CRÍTICO: Não deve existir NENHUMA falsa divergência com o título '*===================================='
    expect(resultado.diferencasDetalhadas.length).toBe(0);

    // CRÍTICO: Pontos iguais não devem conter '--', '*====================================' ou '*'
    expect(resultado.pontosIguais).toHaveLength(3);
    expect(resultado.pontosIguais[0]).toContain('Base Tributável');
    expect(resultado.pontosIguais[1]).toContain('IVA Liquidado');
    expect(resultado.pontosIguais[2]).toContain('IVA Dedutível');
    expect(resultado.pontosIguais).not.toContain('--');
    expect(resultado.pontosIguais).not.toContain('*====================================');
    expect(resultado.pontosIguais).not.toContain('*');

    // Recomendações devem estar limpas
    expect(resultado.recomendacoes).toHaveLength(2);
    expect(resultado.recomendacoes[0].titulo).toBe('Manter o Arquivo Digital Atualizado');
    expect(resultado.recomendacoes[1].titulo).toBe('Reconciliação Mensal Contínua');
  });

  test('Cenário com Divergências Reais: Deve capturar os detalhes legítimos', () => {
    const textoComDifs = `
====================================
1. RESUMO DO CONFRONTO (BALANCETE vs MODELO 7)
====================================
- Total de pontos analisados: 2
- Dados IGUAIS: 1
- Dados com DIFERENÇAS: 1

====================================
2. DETALHE DOS DADOS: IGUAIS vs DIFERENCAS
====================================
| Nome do Campo | Contabilidade | AGT | Status | Diferença Apurada |
| Base Tributável | 10.000.000,00 Kz | 10.000.000,00 Kz | IGUAIS | 0,00 Kz |
| IVA Liquidado (Conta 3453) | 1.400.000,00 Kz | 1.000.000,00 Kz | DIFERENÇA | 400.000,00 Kz |

====================================
3. ANALISE DAS DIFERENCAS DETETADAS
====================================
- **IVA Liquidado (Conta 3453)**
  - **O que está no Balancete:** 1.400.000,00 Kz creditados na Conta 3453
  - **O que foi declarado no Modelo 7:** 1.000.000,00 Kz no Campo 10
  - **Causa provável:** Omissão de faturas emitidas na segunda quinzena
  - **Risco fiscal:** Risco elevado de liquidação adicional e coima perante a AGT

**Pontos IGUAIS**:
- Base Tributável: 10.000.000,00 Kz (em perfeita conformidade)

====================================
4. O QUE FAZER PARA RESOLVER
====================================
1. **Submeter Declaração de Substituição**
   - Regularizar o Modelo 7 retificando o IVA Liquidado.
`;

    const resultado = parseAnaliseIA(textoComDifs);

    expect(resultado.diferencasCount).toBe(1);
    expect(resultado.diferencasDetalhadas).toHaveLength(1);
    expect(resultado.diferencasDetalhadas[0].titulo).toBe('IVA Liquidado (Conta 3453)');
    expect(resultado.diferencasDetalhadas[0].balancete).toContain('1.400.000,00 Kz');
    expect(resultado.diferencasDetalhadas[0].agt).toContain('1.000.000,00 Kz');
    expect(resultado.diferencasDetalhadas[0].causas[0]).toContain('Omissão de faturas');
    expect(resultado.diferencasDetalhadas[0].riscos[0]).toContain('Risco elevado');
    expect(resultado.pontosIguais).toHaveLength(1);
  });

  test('Cenário Completo Balancete vs Modelo 7: Deve extrair Incidências e Apuramento de Ambos os Documentos', () => {
    const textoCompleto = `
====================================
1. RESUMO DO CONFRONTO (BALANCETE vs MODELO 7)
====================================
- Documentos confrontados: Balancete de Verificação e Declaração Modelo 7
- Total de pontos analisados: 5
- Dados IGUAIS (Conformes): 3
- Dados com DIFERENCAS: 2

====================================
2. DETALHE DOS DADOS: IGUAIS vs DIFERENCAS
====================================
| Nome do Campo | Contabilidade (Balancete) | AGT (Modelo 7) | Status | Diferença Apurada |
|---|---|---|---|---|
| Volume de Negócios / Vendas (Incidência do IVA Liquidado) | 280.859.727,67 Kz | 280.859.727,67 Kz | IGUAIS | 0,00 Kz |
| IVA Liquidado (Vendas ou Serviços — Conta 34.5.3 vs Campo 33) | 16.878.091,78 Kz | 16.878.091,78 Kz | IGUAIS | 0,00 Kz |
| Compras e Serviços (Incidência do IVA Dedutível) | 285.973.012,61 Kz | 189.238.764,29 Kz | DIFERENÇA | 96.734.248,32 Kz |
| IVA Dedutível (Compras ou Despesas — Conta 34.5.1/34.5.2 vs Campo 32) | 19.801.638,96 Kz | 26.493.427,00 Kz | DIFERENÇA | 6.691.788,04 Kz |
| Apuramento do IVA do Período (Conta 34.5.7.1 vs Campo 34) | 9.615.335,22 Kz (a recuperar) | 9.615.335,22 Kz (a recuperar) | IGUAIS | 0,00 Kz |

====================================
QUADRO OFICIAL DE APURAMENTO DO IVA (LEI N.º 7/19 - CIVA E PGC ANGOLANO)
====================================
Demonstração do cálculo legal obrigatório em ambos os documentos:
FÓRMULA LEGAL OBRIGATÓRIA: Apuramento do Período = IVA Liquidado (Vendas) − IVA Dedutível (Compras)

1. APURAMENTO SEGUNDO A CONTABILIDADE (BALANCETE PGC):
   - Incidência / Vendas (Conta 61): 280.859.727,67 Kz -> IVA Liquidado (Conta 34.5.3): 16.878.091,78 Kz
   - Incidência / Compras (Conta 21): 285.973.012,61 Kz -> IVA Dedutível (Conta 34.5.1/34.5.2): 19.801.638,96 Kz
   - Cálculo do Apuramento: 16.878.091,78 Kz − 19.801.638,96 Kz
   - Saldo Apurado no Balancete: 9.615.335,22 Kz (IVA a Recuperar - Conta 34.5.7.1)

2. APURAMENTO SEGUNDO A DECLARAÇÃO DA AGT (MODELO 7):
   - Incidência / Vendas (Quadro 09 - Campos 1 e 1.2): 280.859.727,67 Kz -> IVA Liquidado (Campo 33): 16.878.091,78 Kz
   - Incidência / Compras (Quadro 09 - Campo 22): 189.238.764,29 Kz -> IVA Dedutível (Campo 32): 26.493.427,00 Kz
   - Cálculo do Período: 16.878.091,78 Kz − 26.493.427,00 Kz
   - Saldo do Período (Campo 34/35): 9.615.335,22 Kz (Crédito do Período - Campo 34)
   - (+) Excesso a Reportar do Período Anterior (Campo 36): 1.727.293,00 Kz
   - (=) Posição Final Acumulada: 11.342.628,22 Kz (Reporte para o Período Seguinte - Campo 39)

3. CONFRONTO DIRETO DO APURAMENTO DO PERÍODO:
   - Contabilidade: 9.615.335,22 Kz vs AGT (Modelo 7): 9.615.335,22 Kz
   - Situação: IGUAIS (Diferença: 0,00 Kz)
`;

    const res = parseAnaliseIA(textoCompleto);
    expect(res.apuramentoIva).not.toBeNull();
    expect(res.apuramentoIva.isRecuperar).toBe(true);

    // Incidência de Vendas
    expect(res.apuramentoIva.incidenciaVendas.contabilidade).toContain('280.859.727,67');
    expect(res.apuramentoIva.incidenciaVendas.agt).toContain('280.859.727,67');
    expect(res.apuramentoIva.incidenciaVendas.status).toBe('IGUAIS');

    // Incidência de Compras
    expect(res.apuramentoIva.incidenciaCompras.contabilidade).toContain('285.973.012,61');
    expect(res.apuramentoIva.incidenciaCompras.agt).toContain('189.238.764,29');
    expect(res.apuramentoIva.incidenciaCompras.status).toBe('DIFERENÇA');

    // Apuramento Contabilidade
    expect(res.apuramentoIva.apuramentoContabilidade.conta).toBe('Conta 34.5.7.1');
    expect(res.apuramentoIva.apuramentoContabilidade.saldo).toContain('9.615.335,22');

    // Apuramento AGT
    expect(res.apuramentoIva.apuramentoAgt.saldoPeriodo).toContain('9.615.335,22');
    expect(res.apuramentoIva.apuramentoAgt.excessoAnterior).toContain('1.727.293,00');
    expect(res.apuramentoIva.apuramentoAgt.posicaoFinal).toContain('11.342.628,22');

    // Confronto Periodo
    expect(res.apuramentoIva.confrontoPeriodo.status).toBe('IGUAIS');
  });
});
