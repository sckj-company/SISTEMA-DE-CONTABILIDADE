/**
 * Parser inteligente e resiliente para estruturar a resposta da Inteligência Artificial (Groq / Llama / Qwen)
 * e alimentar diretamente os componentes visuais do dashboard StrikingDash.
 *
 * Suporta formatos em tabela Markdown, blocos em lista/marcadores e saídas com formatações variadas.
 */

/**
 * Detecta se uma linha de texto é apenas ruído, decoração ou separador Markdown
 * (ex: '===', '---', '*====================================*', '--', '*', etc.)
 */
export function isLinhaDecorativaOuRuido(str) {
  if (!str) return true;
  const limpa = String(str).trim();
  if (limpa.length === 0) return true;

  // Linhas formadas unicamente por caracteres de separação e pontuação (ex: '===', '---', '*===', '--', '*', '***')
  if (/^[*=\-_~#: \t|/\\`]+$/.test(limpa)) return true;

  // Linhas de modelo/cabeçalho de tabela Markdown ou instruções do prompt
  if (limpa.includes('|') && /O que est[áa] no Balancete/i.test(limpa)) return true;
  if (/^\|?\s*Campo\s*\|\s*O que/i.test(limpa)) return true;
  if (/^\|?\s*Nome do Campo\s*\|/i.test(limpa)) return true;
  if (/^Para cada diferen[çc]a:?/i.test(limpa)) return true;
  if (/^\[Nome do Campo\]/i.test(limpa)) return true;
  if (/^\[valor/i.test(limpa)) return true;

  return false;
}

export function parseValorKz(str) {
  if (!str) return 0;
  const limpo = String(str)
    .replace(/\u00a0/g, ' ')
    .replace(/[^\d,.-]/g, '')
    .trim();
  if (!limpo) return 0;
  const normalizado = limpo.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalizado);
  return isNaN(num) ? 0 : num;
}

export function formatKz(num) {
  const val = typeof num === 'number' ? num : parseValorKz(num);
  return `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;
}

/**
 * Valida se um título de divergência corresponde a uma rubrica ou conta real
 */
export function isTituloDiferencaValido(str) {
  if (!str || isLinhaDecorativaOuRuido(str)) return false;
  const limpo = String(str).replace(/[*=\-_~#: \t|]/g, '').trim();
  // Deve conter pelo menos 3 caracteres alfabéticos reais
  if (!/[a-zA-ZÀ-ÿ]{3,}/.test(limpo)) return false;
  // Não pode ser cabeçalho de seção
  if (/^AN[ÁA]LISE/i.test(limpo) || /^PONTOS IGUAIS/i.test(limpo) || /^RESUMO/i.test(limpo) || /^DETALHE/i.test(limpo)) return false;
  // Se expressar ausência de divergência
  if (/sem diferen[çc]a|nenhuma diferen[çc]a|sem diverg[êe]ncia|nenhuma diverg[êe]ncia|em perfeita conformidade/i.test(str)) {
    return false;
  }
  return true;
}

/**
 * Limpa marcadores de tópicos (- ou * ou •) e asteriscos, preservando o texto substantivo
 */
export function sanitizarLinhaTopico(str) {
  if (!str) return '';
  let limpo = String(str).trim();
  if (isLinhaDecorativaOuRuido(limpo)) return '';
  limpo = limpo.replace(/^[-*•\s]+/, '').replace(/\*\*/g, '').trim();
  if (isLinhaDecorativaOuRuido(limpo)) return '';
  return limpo;
}

/**
 * Extrai o valor limpo de um campo rotulado (ex: '- **O que está no Balancete:** 500.000 Kz')
 */
export function extrairValorRotulado(str) {
  if (!str) return '';
  let limpo = String(str).trim();
  if (isLinhaDecorativaOuRuido(limpo)) return '';
  limpo = limpo.replace(/^[-*•\s]+/, '').trim();
  // Remove rótulo até o ':' (incluindo negritos e variações)
  limpo = limpo.replace(/^(?:\*\*)?[^*:\n]+(?::\*\*|\*\*:\s*|\*\*\s*:\s*|:\s*)\s*/i, '').trim();
  limpo = limpo.replace(/\*\*/g, '').trim();
  if (isLinhaDecorativaOuRuido(limpo)) return '';
  return limpo;
}

/**
 * Alias compatível com versões anteriores
 */
export function sanitizarValorTexto(str) {
  return extrairValorRotulado(str);
}

export function parseAnaliseIA(texto) {
  if (!texto || typeof texto !== 'string') return null;

  // 1. Extrair Seções Principais (suporta PT, EN, ZH e formatos variados)
  const resumoMatch = texto.match(/(?:1\s*[-–.]\s*(?:RESUMO|SUMMARY|概述|总结|摘要)|GENERAL SUMMARY)[\s\S]*?(?=(?:2\s*[-–.]\s*(?:DETALHE|DETAIL|明细)|FIELD DETAIL)|$)/i);
  const detalheMatch = texto.match(/(?:2\s*[-–.]\s*(?:DETALHE|DETAIL|明细)|FIELD DETAIL)[\s\S]*?(?=(?:3\s*[-–.]\s*(?:AN[ÁA]LISE|ANALYSIS|分析)|TECHNICAL ANALYSIS)|$)/i);
  const analiseMatch = texto.match(/(?:3\s*[-–.]\s*(?:AN[ÁA]LISE|ANALYSIS|分析)|TECHNICAL ANALYSIS)[\s\S]*?(?=(?:4\s*[-–.]\s*(?:O QUE FAZER|RECOMENDA[ÇC]|RECOMMENDATION|建议)|FINAL RECOMMENDATIONS)|$)/i);
  const recomendacoesMatch = texto.match(/(?:4\s*[-–.]\s*(?:O QUE FAZER|RECOMENDA[ÇC][ÕO]ES|RECOMMENDATION|建议)|FINAL RECOMMENDATIONS)[\s\S]*$/i);

  const resumoTexto = resumoMatch ? resumoMatch[0] : '';
  const detalheTexto = detalheMatch ? detalheMatch[0] : '';
  const analiseTexto = analiseMatch ? analiseMatch[0] : '';
  const recomendacoesTexto = recomendacoesMatch ? recomendacoesMatch[0] : '';

  // 2. Metadados do Resumo (suporta markdown ** em números e rótulos em PT, EN, ZH)
  const docsMatch = resumoTexto.match(/(?:Documentos confrontados|Documents compared|对比文件)\*?\*?:\s*([^\n\r]+)/i);
  const totalMatch = resumoTexto.match(/(?:Total de pontos analisados|Total fields analyzed|Total points analyzed|总分析点数|分析总数)[^:]*:\s*(?:\*\*)?(\d+)(?:\*\*)?/i);
  const iguaisMatch = resumoTexto.match(/(?:Dados IGUAIS|Conforming fields|Conforming data|相同数据|符合数据)[^:]*:\s*(?:\*\*)?(\d+)(?:\*\*)?/i);
  const difsMatch = resumoTexto.match(/(?:Dados com DIFER[EÊeê]NCIAS|Divergences found|差异数据|存在差异)[^:]*:\s*(?:\*\*)?(\d+)(?:\*\*)?/i);

  const documentosConfrontados = docsMatch
    ? docsMatch[1].replace(/\*\*/g, '').trim()
    : 'Balancete de Verificação da Contabilidade e Declaração Modelo 7 de IVA';

  // 3. Extrair Itens de Confronto (Tabela Markdown OU Blocos em Lista)
  const itensConfronto = [];
  if (detalheTexto) {
    // Caso A: Tabela Markdown com barras verticais "|"
    const linhas = detalheTexto.split('\n');
    for (const linha of linhas) {
      if (
        linha.includes('|') &&
        !linha.includes('---') &&
        !linha.toLowerCase().includes('nome do campo') &&
        !linha.toLowerCase().includes('field name') &&
        !linha.toLowerCase().includes('字段') &&
        !linha.toLowerCase().includes('ponto confrontado')
      ) {
        const partes = linha.split('|').map((p) => p.trim()).filter(Boolean);
        if (partes.length >= 3) {
          const statusRaw = (partes[3] || partes[2] || '').toUpperCase();
          const isDif = statusRaw.includes('DIFEREN') || statusRaw.includes('DIVERG') || statusRaw.includes('差异') || statusRaw.includes('ALERTA');
          const isOk = statusRaw.includes('IGUAL') || statusRaw.includes('IGUAIS') || statusRaw.includes('OK') || statusRaw.includes('CONFORME') || statusRaw.includes('CONFORM') || statusRaw.includes('符合') || statusRaw.includes('相同');
          let status = isDif ? 'DIFERENÇA' : isOk ? 'IGUAIS' : 'INFO';

          const campoNome = partes[0].replace(/\*\*/g, '').trim();
          const contab = partes[1] ? partes[1].replace(/\*\*/g, '').trim() : '—';
          const agt = partes[2] ? partes[2].replace(/\*\*/g, '').trim() : '—';
          const dif = partes[4]
            ? partes[4].replace(/\*\*/g, '').trim()
            : status === 'IGUAIS'
            ? '0,00 Kz'
            : 'Diferença apurada';

          if (parseValorKz(dif) === 0 && !isDif) {
            status = 'IGUAIS';
          }

          itensConfronto.push({
            campo: campoNome,
            contabilidade: contab,
            agt: agt,
            status: status,
            diferenca: dif,
          });
        }
      }
    }

    // Caso B: Blocos em formato lista/tópicos (ex: **Campo** \n - Contabilidade: ... \n - AGT: ... \n - Status: ... \n - Diferença: ...)
    if (itensConfronto.length === 0) {
      const blocos = detalheTexto
        .replace(/^[=\s\w\d-–.:]*DETALHE[^\n]*\n+/i, '')
        .split(/\n(?=(?:[-*]\s*)?\*\*[^*]+\*\*|\[.+?\])/);

      for (const bloco of blocos) {
        const linhasBloco = bloco.split('\n').map((l) => l.trim()).filter(Boolean);
        if (linhasBloco.length === 0) continue;

        const primeiraLinha = linhasBloco[0];
        if (primeiraLinha.startsWith('===') || primeiraLinha.toLowerCase().includes('detalhe dos dados')) continue;

        const campoNome = primeiraLinha
          .replace(/^[-*]\s*/, '')
          .replace(/\*\*/g, '')
          .replace(/^\[|\]$/g, '')
          .trim();

        let contab = '—';
        let agt = '—';
        let status = 'INFO';
        let dif = '0,00 Kz';

        for (const l of linhasBloco) {
          const matchContab = l.match(/(?:Contabilidade|Balancete|Accounting|会计|财务)[^:]*:\s*([^\n\r]+)/i);
          if (matchContab) contab = matchContab[1].replace(/\*\*/g, '').trim();

          const matchAgt = l.match(/(?:AGT|Modelo\s*7|税务申报|税务局)[^:]*:\s*([^\n\r]+)/i);
          if (matchAgt) agt = matchAgt[1].replace(/\*\*/g, '').trim();

          const matchStatus = l.match(/(?:Status|Estado|状态)[^:]*:\s*([^\n\r]+)/i);
          if (matchStatus) {
            const raw = matchStatus[1].toUpperCase();
            if (raw.includes('DIFEREN') || raw.includes('DIVERG') || raw.includes('差异') || raw.includes('ALERTA')) status = 'DIFERENÇA';
            else if (raw.includes('IGUAIS') || raw.includes('OK') || raw.includes('CONFORME') || raw.includes('CONFORM') || raw.includes('符合') || raw.includes('相同')) status = 'IGUAIS';
          }

          const matchDif = l.match(/(?:Diferen[çc]a|Difference|差异金额|差异)[^:]*:\s*([^\n\r]+)/i);
          if (matchDif) dif = matchDif[1].replace(/\*\*/g, '').trim();
        }

        if (campoNome && (contab !== '—' || agt !== '—')) {
          if (status === 'INFO') {
            if (dif !== '0,00 Kz' && !dif.includes('0,00')) status = 'DIFERENÇA';
            else status = 'IGUAIS';
          }
          itensConfronto.push({
            campo: campoNome,
            contabilidade: contab,
            agt: agt,
            status: status,
            diferenca: dif,
          });
        }
      }
    }
  }

  // 4. Observações no detalhe
  const obsMatch = detalheTexto.match(/\*Observa[çc][ãa]o\*:\s*([^\n\r]+(?:\n[^\n\r=]+)*)/i);
  const observacao = obsMatch ? obsMatch[1].replace(/\*\*/g, '').trim() : null;

  // 5. Contagens
  const total = totalMatch ? parseInt(totalMatch[1], 10) : itensConfronto.length;
  const iguaisCount = iguaisMatch ? parseInt(iguaisMatch[1], 10) : itensConfronto.filter((i) => i.status === 'IGUAIS').length;
  const diferencasCount = difsMatch
    ? parseInt(difsMatch[1], 10)
    : (total - iguaisCount >= 0 ? total - iguaisCount : itensConfronto.filter((i) => i.status === 'DIFERENÇA').length);

  // 6. Parse da Seção 3: Análise Técnica das Diferenças
  const diferencasDetalhadas = [];
  const pontosIguais = [];

  if (analiseTexto) {
    const partesAnalise = analiseTexto.split(/\*\*Pontos IGUAIS\*\*:?/i);
    const parteDifs = partesAnalise[0] || '';
    const parteIguais = partesAnalise[1] || '';

    if (parteIguais) {
      const pIguaisEncontrados = parteIguais
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => !isLinhaDecorativaOuRuido(l))
        .map((l) => sanitizarLinhaTopico(l))
        .filter((l) => l.length > 2 && /[a-zA-ZÀ-ÿ0-9]/.test(l) && !isLinhaDecorativaOuRuido(l));
      pontosIguais.push(...pIguaisEncontrados);
    }

    // Identificar blocos de diferenças por:
    // a) **Ponto de diferença**: ...
    // b) - **Nome – 0,01 Kz**
    // c) Linhas em negrito seguidas de "O que está no Balancete"
    const blocosDifs = parteDifs
      .replace(/^[=\s\w\d-–.:]*AN[ÁA]LISE[^\n]*\n+/i, '')
      .split(/\n(?=(?:[-*]\s*)?(?:\*\*Ponto(?:s)? de diferen[çc]a\*\*:?|\*\*[^*]+(?:\s*[–-]\s*[^*]+)?\*\*))/i);

    for (const b of blocosDifs) {
      const lines = b
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !isLinhaDecorativaOuRuido(l));
      if (lines.length === 0) continue;

      const firstLine = lines[0];
      if (isLinhaDecorativaOuRuido(firstLine)) continue;

      const titulo = firstLine
        .replace(/^[-*•\s]+/, '')
        .replace(/\*\*Ponto(?:s)? de diferen[çc]a\*\*:?/i, '')
        .replace(/\*\*/g, '')
        .trim();

      if (!isTituloDiferencaValido(titulo)) continue;

      let balancete = '';
      let agt = '';
      const causas = [];
      const riscos = [];
      let currentMode = '';

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (isLinhaDecorativaOuRuido(line)) continue;

        if (/O que est[áa] no Balancete/i.test(line)) {
          if (line.includes('|')) continue;
          balancete = extrairValorRotulado(line);
          currentMode = 'balancete';
        } else if (/O que foi declarado no Modelo/i.test(line)) {
          if (line.includes('|')) continue;
          agt = extrairValorRotulado(line);
          currentMode = 'agt';
        } else if (/Causa prov[áa]vel/i.test(line)) {
          if (line.includes('|')) continue;
          const direct = extrairValorRotulado(line);
          if (direct && !isLinhaDecorativaOuRuido(direct)) causas.push(direct);
          currentMode = 'causa';
        } else if (/Risco fiscal/i.test(line)) {
          if (line.includes('|')) continue;
          const direct = extrairValorRotulado(line);
          if (direct && !isLinhaDecorativaOuRuido(direct)) riscos.push(direct);
          currentMode = 'risco';
        } else if (line.startsWith('-') || line.startsWith('*') || line.startsWith('•')) {
          const sub = sanitizarLinhaTopico(line);
          if (sub && !isLinhaDecorativaOuRuido(sub)) {
            if (currentMode === 'causa') causas.push(sub);
            else if (currentMode === 'risco') riscos.push(sub);
          }
        }
      }

      if (titulo && (balancete || agt || causas.length > 0 || riscos.length > 0)) {
        diferencasDetalhadas.push({ titulo, balancete, agt, causas, riscos });
      }
    }
  }

  // Validação de consistência:
  // Se o resumo declarou explicitamente 0 diferenças e a tabela de confronto tem 0 diferenças,
  // descartar qualquer falso positivo capturado por ruído de formatação.
  const totalDifsTabela = itensConfronto.filter((i) => i.status === 'DIFERENÇA').length;
  if (diferencasCount === 0 && totalDifsTabela === 0) {
    diferencasDetalhadas.length = 0;
  }

  // Fallbacks inteligentes para garantir que a interface NUNCA fique vazia
  if (pontosIguais.length === 0 && itensConfronto.length > 0) {
    const conformes = itensConfronto.filter((i) => i.status === 'IGUAIS');
    for (const c of conformes) {
      pontosIguais.push(`${c.campo}: Contabilidade (${c.contabilidade}) e AGT (${c.agt}) em perfeita conformidade.`);
    }
  }

  if (diferencasDetalhadas.length === 0 && totalDifsTabela > 0) {
    const divergentes = itensConfronto.filter((i) => i.status === 'DIFERENÇA');
    for (const d of divergentes) {
      diferencasDetalhadas.push({
        titulo: `${d.campo} – Divergência de ${d.diferenca}`,
        balancete: d.contabilidade,
        agt: d.agt,
        causas: [`Divergência apurada entre o Balancete (${d.contabilidade}) e a Declaração AGT (${d.agt}).`],
        riscos: [`Verificar o suporte documental para regularizar a diferença de ${d.diferenca}.`],
      });
    }
  }

  // 7. Parse da Seção 4: Recomendações e Resultado Esperado
  const recomendacoesLista = [];
  let resultadoEsperado = [];

  if (recomendacoesTexto) {
    // Remover o cabeçalho "4. O QUE FAZER PARA RESOLVER"
    const textoSemTitulo = recomendacoesTexto
      .replace(/^[=\s\w\d-–.:]*(?:O QUE FAZER|RECOMENDA[ÇC][ÕO]ES)[^\n]*\n+/i, '');

    // Isolar o bloco "Resultado esperado" para não se misturar com as ações recomendadas
    const partesRec = textoSemTitulo.split(/(?:\*\*Resultado esperado\*\*|Resultado esperado:?)/i);
    const parteAcoes = partesRec[0] || '';
    const parteResultado = partesRec[1] || '';

    const recLines = parteAcoes.split('\n');
    let currentRec = null;

    for (const line of recLines) {
      const trimmed = line.trim();
      if (isLinhaDecorativaOuRuido(trimmed)) continue;

      const numMatch = trimmed.match(/^(\d+)[.)]\s*(.*)/);
      if (numMatch) {
        const titleRaw = sanitizarLinhaTopico(numMatch[2]);
        if (titleRaw && !isLinhaDecorativaOuRuido(titleRaw)) {
          if (currentRec) recomendacoesLista.push(currentRec);
          currentRec = {
            numero: parseInt(numMatch[1], 10),
            titulo: titleRaw,
            detalhes: [],
          };
        }
      } else if (currentRec && (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•'))) {
        const detail = sanitizarLinhaTopico(trimmed);
        if (detail && !isLinhaDecorativaOuRuido(detail)) currentRec.detalhes.push(detail);
      } else if (
        currentRec &&
        trimmed &&
        !isLinhaDecorativaOuRuido(trimmed) &&
        !trimmed.startsWith('4 -') &&
        !trimmed.startsWith('4.')
      ) {
        const detail = sanitizarLinhaTopico(trimmed);
        if (detail && !isLinhaDecorativaOuRuido(detail) && currentRec.detalhes.length === 0 && !trimmed.toLowerCase().includes('assim, a empresa')) {
          currentRec.detalhes.push(detail);
        }
      }
    }
    if (currentRec) recomendacoesLista.push(currentRec);

    // 8. Resultado Esperado
    if (parteResultado) {
      resultadoEsperado = parteResultado
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => !isLinhaDecorativaOuRuido(l))
        .map((l) => sanitizarLinhaTopico(l))
        .filter((l) => l.length > 2 && !isLinhaDecorativaOuRuido(l));
    } else {
      const conclusaoMatch = textoSemTitulo.match(/(?:Assim,\s*a empresa[\s\S]*?)(?=$)/i);
      if (conclusaoMatch) {
        resultadoEsperado = [conclusaoMatch[0].replace(/\n+/g, ' ').trim()];
      }
    }
  }

  // 9. Quadro Oficial de Apuramento do IVA (Lei n.º 7/19 - Código do IVA e PGC Angolano)
  // Três Resultados Oficiais do PGC Angolano (Contas 34.5):
  // 1. Conta 34.5.6.1: IVA a pagar de apuramento (quando Liquidado > Dedutível)
  // 2. Conta 34.5.7.1: IVA a recuperar de apuramentos (quando Dedutível > Liquidado) — A empresa NÃO paga IVA, acumula p/ mês seguinte
  // 3. Conta 34.5.8.1: IVA reembolsos pedidos (quando solicitado reembolso à AGT)
  const itemLiquidado = itensConfronto.find((i) =>
    (i.campo.toLowerCase().includes('liquidado') || i.campo.toLowerCase().includes('favor do estado')) &&
    !i.campo.toLowerCase().includes('incidência') &&
    !i.campo.toLowerCase().includes('incidencia') &&
    !i.campo.toLowerCase().includes('volume de negócios') &&
    !i.campo.toLowerCase().includes('volume de negocios')
  );
  const itemDedutivel = itensConfronto.find((i) =>
    (i.campo.toLowerCase().includes('dedut') ||
     i.campo.toLowerCase().includes('suportado') ||
     i.campo.toLowerCase().includes('favor do sujeito passivo')) &&
    !i.campo.toLowerCase().includes('incidência') &&
    !i.campo.toLowerCase().includes('incidencia') &&
    !i.campo.toLowerCase().includes('compras e serviços')
  );

  const itemBaseVendas = itensConfronto.find((i) =>
    (i.campo.toLowerCase().includes('vendas') ||
     i.campo.toLowerCase().includes('volume de negócios') ||
     i.campo.toLowerCase().includes('base tributável') ||
     i.campo.toLowerCase().includes('incidência do iva liquidado')) &&
    !i.campo.toLowerCase().includes('iva liquidado') &&
    !i.campo.toLowerCase().includes('conta 34')
  );

  const itemBaseCompras = itensConfronto.find((i) =>
    (i.campo.toLowerCase().includes('compras') ||
     i.campo.toLowerCase().includes('existências') ||
     i.campo.toLowerCase().includes('incidência do iva dedutível')) &&
    !i.campo.toLowerCase().includes('iva dedutível') &&
    !i.campo.toLowerCase().includes('iva suportado') &&
    !i.campo.toLowerCase().includes('conta 34')
  );

  const itemExcessoAnterior = itensConfronto.find((i) =>
    i.campo.toLowerCase().includes('excesso a reportar') ||
    i.campo.toLowerCase().includes('campo 36') ||
    i.campo.toLowerCase().includes('períodos anteriores')
  );

  // Linha genérica ou explícita de Apuramento do IVA
  const itemApuramentoGeral = itensConfronto.find((i) =>
    i.campo.toLowerCase().includes('apuramento')
  );

  const textoApuramentoValores = (
    (itemApuramentoGeral?.contabilidade || '') + ' ' +
    (itemApuramentoGeral?.agt || '')
  ).toLowerCase();

  const apuramentoDizPagar = textoApuramentoValores.includes('a pagar') || textoApuramentoValores.includes('pagar');
  const apuramentoDizRecuperar = textoApuramentoValores.includes('a recuperar') || textoApuramentoValores.includes('recuperar') || textoApuramentoValores.includes('crédito');

  let itemPagar = itensConfronto.find((i) =>
    (i.campo.toLowerCase().includes('pagar') && !i.campo.toLowerCase().includes('recuperar')) ||
    i.campo.toLowerCase().includes('34.5.6.1') ||
    i.campo.toLowerCase().includes('imposto a pagar')
  );
  let itemRecuperar = itensConfronto.find((i) =>
    (i.campo.toLowerCase().includes('recuperar') && !i.campo.toLowerCase().includes('pagar')) ||
    i.campo.toLowerCase().includes('34.5.7.1') ||
    i.campo.toLowerCase().includes('crédito fiscal') ||
    i.campo.toLowerCase().includes('excesso a reportar')
  );
  const itemReembolso = itensConfronto.find((i) =>
    i.campo.toLowerCase().includes('reembolso') ||
    i.campo.toLowerCase().includes('34.5.8.1')
  );

  // Se a tabela tiver linha genérica com ambos os termos no título:
  if (itemApuramentoGeral) {
    if (apuramentoDizPagar && !itemPagar) itemPagar = itemApuramentoGeral;
    if (apuramentoDizRecuperar && !itemRecuperar) itemRecuperar = itemApuramentoGeral;
  }

  // Valores numéricos para determinar dinamicamente a situação legal (CIVA Art. 19.º)
  const valLiq = Math.max(parseValorKz(itemLiquidado?.agt), parseValorKz(itemLiquidado?.contabilidade));
  const valDed = Math.max(parseValorKz(itemDedutivel?.agt), parseValorKz(itemDedutivel?.contabilidade));
  const valRec = Math.max(parseValorKz(itemRecuperar?.agt), parseValorKz(itemRecuperar?.contabilidade));
  const valPag = Math.max(parseValorKz(itemPagar?.agt), parseValorKz(itemPagar?.contabilidade));
  const valReemb = Math.max(parseValorKz(itemReembolso?.agt), parseValorKz(itemReembolso?.contabilidade));

  // Verificação nos blocos de texto da análise gerada (Contas 34.5)
  const matchPagarCiva = texto.match(/Conta\s*34\.5\.6\.1[^\n:]*:\s*([^\n\(\)]+)/i);
  const matchRecuperarCiva = texto.match(/Conta\s*34\.5\.7\.1[^\n:]*:\s*([^\n\(\)]+)/i);
  const valCivaPagar = parseValorKz(matchPagarCiva ? matchPagarCiva[1] : null);
  const valCivaRecuperar = parseValorKz(matchRecuperarCiva ? matchRecuperarCiva[1] : null);

  // Determinação rigorosa da Situação Legal segundo o Código do IVA (Art. 19.º):
  let tipoApuramento = 'PAGAR';
  if (valDed > valLiq && valDed > 0) {
    // 1. IVA Dedutível supera o IVA Liquidado -> A empresa NÃO paga IVA, acumula crédito fiscal
    tipoApuramento = 'RECUPERAR';
  } else if (valLiq > valDed && valLiq > 0) {
    // 2. IVA Liquidado supera o IVA Dedutível -> Imposto exigível pelo Estado a pagar
    tipoApuramento = 'PAGAR';
  } else if (valCivaRecuperar > 0 && valCivaPagar === 0) {
    tipoApuramento = 'RECUPERAR';
  } else if (valCivaPagar > 0) {
    tipoApuramento = 'PAGAR';
  } else if (apuramentoDizRecuperar && !apuramentoDizPagar) {
    tipoApuramento = 'RECUPERAR';
  } else if (apuramentoDizPagar) {
    tipoApuramento = 'PAGAR';
  } else if (valReemb > 0) {
    tipoApuramento = 'REEMBOLSO';
  } else if (valRec > 0 && valPag === 0) {
    tipoApuramento = 'RECUPERAR';
  } else {
    tipoApuramento = 'PAGAR';
  }

  // Helper para limpar sufixos como (a pagar) ou (a recuperar) dos valores exibidos
  const limparSufixo = (val) => {
    if (!val) return '0,00 Kz';
    return String(val).replace(/\s*\([^\)]*\)/g, '').trim();
  };

  // Valores matemáticos e apurados oficiais
  const valorApuradoPagar = valLiq > valDed
    ? formatKz(valLiq - valDed)
    : '0,00 Kz';
  const valorApuradoRecuperar = valDed > valLiq
    ? formatKz(valDed - valLiq)
    : '0,00 Kz';

  const valorAtivoPagarContab = (itemPagar && limparSufixo(itemPagar.contabilidade) !== '0,00 Kz' && limparSufixo(itemPagar.contabilidade) !== '—')
    ? limparSufixo(itemPagar.contabilidade)
    : valorApuradoPagar;
  const valorAtivoPagarAgt = (itemPagar && limparSufixo(itemPagar.agt) !== '0,00 Kz' && limparSufixo(itemPagar.agt) !== '—')
    ? limparSufixo(itemPagar.agt)
    : valorApuradoPagar;

  const valorAtivoRecuperarContab = (itemRecuperar && limparSufixo(itemRecuperar.contabilidade) !== '0,00 Kz' && limparSufixo(itemRecuperar.contabilidade) !== '—')
    ? limparSufixo(itemRecuperar.contabilidade)
    : valorApuradoRecuperar;
  const valorAtivoRecuperarAgt = (itemRecuperar && limparSufixo(itemRecuperar.agt) !== '0,00 Kz' && limparSufixo(itemRecuperar.agt) !== '—')
    ? limparSufixo(itemRecuperar.agt)
    : valorApuradoRecuperar;

  const statusPagar = (parseValorKz(valorAtivoPagarContab) === parseValorKz(valorAtivoPagarAgt) || itemPagar?.status === 'IGUAIS')
    ? 'IGUAIS'
    : (itemPagar?.status || 'DIFERENÇA');

  const statusRecuperar = (parseValorKz(valorAtivoRecuperarContab) === parseValorKz(valorAtivoRecuperarAgt) || itemRecuperar?.status === 'IGUAIS')
    ? 'IGUAIS'
    : (itemRecuperar?.status || 'DIFERENÇA');

  const diferencaPagar = (statusPagar === 'IGUAIS' || parseValorKz(valorAtivoPagarContab) === parseValorKz(valorAtivoPagarAgt))
    ? '0,00 Kz'
    : (itemPagar?.diferenca || 'Diferença apurada');

  const diferencaRecuperar = (statusRecuperar === 'IGUAIS' || parseValorKz(valorAtivoRecuperarContab) === parseValorKz(valorAtivoRecuperarAgt))
    ? '0,00 Kz'
    : (itemRecuperar?.diferenca || 'Diferença apurada');

  const tresResultadosPGC = [
    {
      codigo: '34.5.6.1',
      nome: 'IVA a pagar de apuramento',
      regra: 'Quando IVA Liquidado > IVA Dedutível (Campo 37 da AGT)',
      ativo: tipoApuramento === 'PAGAR',
      cor: '#ff4d4f',
      valorContabilidade: tipoApuramento === 'PAGAR' ? valorAtivoPagarContab : '0,00 Kz',
      valorAgt: tipoApuramento === 'PAGAR' ? valorAtivoPagarAgt : '0,00 Kz',
      status: tipoApuramento === 'PAGAR' ? statusPagar : 'IGUAIS',
    },
    {
      codigo: '34.5.7.1',
      nome: 'IVA a recuperar de apuramentos (Crédito Fiscal)',
      regra: 'Quando IVA Dedutível > IVA Liquidado (Campo 34/39 da AGT) — A empresa não paga IVA, o crédito acumula para o mês seguinte',
      ativo: tipoApuramento === 'RECUPERAR',
      cor: '#52c41a',
      valorContabilidade: tipoApuramento === 'RECUPERAR' ? valorAtivoRecuperarContab : '0,00 Kz',
      valorAgt: tipoApuramento === 'RECUPERAR' ? valorAtivoRecuperarAgt : '0,00 Kz',
      status: tipoApuramento === 'RECUPERAR' ? statusRecuperar : 'IGUAIS',
    },
    {
      codigo: '34.5.8.1',
      nome: 'IVA reembolsos pedidos',
      regra: 'Reembolso (Parcial ou Total) solicitado à AGT (Campo 40 da AGT)',
      ativo: tipoApuramento === 'REEMBOLSO',
      cor: '#1890ff',
      valorContabilidade: itemReembolso?.contabilidade || '0,00 Kz',
      valorAgt: itemReembolso?.agt || '0,00 Kz',
      status: itemReembolso?.status || 'IGUAIS',
    },
  ];

  // Extrações específicas do QUADRO OFICIAL DE APURAMENTO DO IVA no texto
  const matchIncidVendasContab = texto.match(/Incidência\s*\/\s*Vendas[^\n:]*\(Conta\s*61\):\s*([^\n\-\>]+)/i);
  const matchIncidVendasAgt = texto.match(/Incidência\s*\/\s*Vendas[^\n:]*\(Quadro\s*09[^\)]*\):\s*([^\n\-\>]+)/i);
  const matchIncidComprasContab = texto.match(/Incidência\s*\/\s*Compras[^\n:]*\(Conta\s*21[^\)]*\):\s*([^\n\-\>]+)/i);
  const matchIncidComprasAgt = texto.match(/Incidência\s*\/\s*Compras[^\n:]*\(Quadro\s*09[^\)]*\):\s*([^\n\-\>]+)/i);

  const matchCalculoContab = texto.match(/Cálculo do Apuramento:\s*([^\n]+)/i);
  const matchCalculoAgt = texto.match(/Cálculo do Período:\s*([^\n]+)/i);
  const matchSaldoBalancete = texto.match(/Saldo Apurado no Balancete:\s*([^\n\(\)]+)/i);
  const matchSaldoAgtPeriodo = texto.match(/Saldo do Período\s*\([^\)]*\):\s*([^\n\(\)]+)/i);
  const matchExcessoAnteriorTxt = texto.match(/(?:\(\+\)\s*)?Excesso a Reportar[^\n:]*:\s*([^\n\(\)]+)/i);
  const matchPosicaoFinalTxt = texto.match(/(?:\(=\)\s*)?Posição Final Acumulada:\s*([^\n\(\)]+)/i);

  const valIncidVendasContab = matchIncidVendasContab ? matchIncidVendasContab[1].trim() : (itemBaseVendas?.contabilidade || '—');
  const valIncidVendasAgt = matchIncidVendasAgt ? matchIncidVendasAgt[1].trim() : (itemBaseVendas?.agt || '—');
  const difNumVendas = Math.abs(parseValorKz(valIncidVendasContab) - parseValorKz(valIncidVendasAgt));
  const difIncidVendas = (parseValorKz(valIncidVendasContab) === parseValorKz(valIncidVendasAgt) || (itemBaseVendas && itemBaseVendas.status === 'IGUAIS'))
    ? '0,00 Kz'
    : formatKz(difNumVendas > 0 ? difNumVendas : (itemBaseVendas ? itemBaseVendas.diferenca : 0));
  const statusIncidVendas = (parseValorKz(valIncidVendasContab) === parseValorKz(valIncidVendasAgt) || (itemBaseVendas && itemBaseVendas.status === 'IGUAIS')) ? 'IGUAIS' : 'DIFERENÇA';

  const incidenciaVendas = {
    contabilidade: valIncidVendasContab,
    agt: valIncidVendasAgt,
    status: statusIncidVendas,
    diferenca: difIncidVendas,
  };

  const valIncidComprasContab = matchIncidComprasContab ? matchIncidComprasContab[1].trim() : (itemBaseCompras?.contabilidade || '—');
  const valIncidComprasAgt = matchIncidComprasAgt ? matchIncidComprasAgt[1].trim() : (itemBaseCompras?.agt || '—');
  const difNumCompras = Math.abs(parseValorKz(valIncidComprasContab) - parseValorKz(valIncidComprasAgt));
  const difIncidCompras = (parseValorKz(valIncidComprasContab) === parseValorKz(valIncidComprasAgt) || (itemBaseCompras && itemBaseCompras.status === 'IGUAIS'))
    ? '0,00 Kz'
    : formatKz(difNumCompras > 0 ? difNumCompras : (itemBaseCompras ? itemBaseCompras.diferenca : 0));
  const statusIncidCompras = (parseValorKz(valIncidComprasContab) === parseValorKz(valIncidComprasAgt) || (itemBaseCompras && itemBaseCompras.status === 'IGUAIS')) ? 'IGUAIS' : 'DIFERENÇA';

  const incidenciaCompras = {
    contabilidade: valIncidComprasContab,
    agt: valIncidComprasAgt,
    status: statusIncidCompras,
    diferenca: difIncidCompras,
  };

  const saldoContabApurado = matchSaldoBalancete
    ? matchSaldoBalancete[1].trim()
    : (tipoApuramento === 'RECUPERAR' ? valorAtivoRecuperarContab : valorAtivoPagarContab);

  const apuramentoContabilidade = {
    titulo: 'Contabilidade (Balancete PGC)',
    conta: tipoApuramento === 'RECUPERAR' ? 'Conta 34.5.7.1' : (tipoApuramento === 'REEMBOLSO' ? 'Conta 34.5.8.1' : 'Conta 34.5.6.1'),
    rubrica: tipoApuramento === 'RECUPERAR' ? 'IVA a Recuperar (Crédito Fiscal)' : (tipoApuramento === 'REEMBOLSO' ? 'IVA Reembolsos Pedidos' : 'IVA a Pagar ao Estado'),
    calculo: matchCalculoContab ? matchCalculoContab[1].trim() : `${itemLiquidado?.contabilidade || '0,00 Kz'} − ${itemDedutivel?.contabilidade || '0,00 Kz'}`,
    saldo: saldoContabApurado,
  };

  const saldoAgtPeriodo = matchSaldoAgtPeriodo
    ? matchSaldoAgtPeriodo[1].trim()
    : (tipoApuramento === 'RECUPERAR' ? valorAtivoRecuperarAgt : valorAtivoPagarAgt);

  const valExcessoAnterior = matchExcessoAnteriorTxt
    ? matchExcessoAnteriorTxt[1].trim()
    : (itemExcessoAnterior?.agt && itemExcessoAnterior.agt !== '—' && parseValorKz(itemExcessoAnterior.agt) > 0 ? itemExcessoAnterior.agt : null);

  const valPosicaoFinal = matchPosicaoFinalTxt
    ? matchPosicaoFinalTxt[1].trim()
    : (valExcessoAnterior && parseValorKz(valExcessoAnterior) > 0
        ? formatKz(parseValorKz(saldoAgtPeriodo) + parseValorKz(valExcessoAnterior))
        : saldoAgtPeriodo);

  const apuramentoAgt = {
    titulo: 'Declaração AGT (Modelo 7)',
    campo: tipoApuramento === 'RECUPERAR' ? 'Campo 34 (Crédito do Período)' : (tipoApuramento === 'REEMBOLSO' ? 'Campo 40 (Reembolso)' : 'Campo 35 (Dívida do Período)'),
    calculo: matchCalculoAgt ? matchCalculoAgt[1].trim() : `${itemLiquidado?.agt || '0,00 Kz'} − ${itemDedutivel?.agt || '0,00 Kz'}`,
    saldoPeriodo: saldoAgtPeriodo,
    excessoAnterior: valExcessoAnterior && parseValorKz(valExcessoAnterior) > 0 ? valExcessoAnterior : null,
    posicaoFinal: valPosicaoFinal,
    rotuloFinal: tipoApuramento === 'RECUPERAR' ? 'Reporte p/ Mês Seguinte (Campo 39)' : 'Imposto Líquido a Pagar (Campo 37)',
  };

  const difConfrontoPeriodo = Math.abs(parseValorKz(apuramentoContabilidade.saldo) - parseValorKz(apuramentoAgt.saldoPeriodo));
  const confrontoPeriodo = {
    status: (difConfrontoPeriodo <= 0.05 || (tipoApuramento === 'RECUPERAR' ? statusRecuperar === 'IGUAIS' : statusPagar === 'IGUAIS')) ? 'IGUAIS' : 'DIFERENÇA',
    diferenca: difConfrontoPeriodo <= 0.05 ? '0,00 Kz' : formatKz(difConfrontoPeriodo),
  };

  const apuramentoIva = (itemLiquidado || itemDedutivel || itemPagar || itemRecuperar || itemApuramentoGeral)
    ? {
        tipoApuramento,
        isRecuperar: tipoApuramento === 'RECUPERAR',
        isPagar: tipoApuramento === 'PAGAR',
        isReembolso: tipoApuramento === 'REEMBOLSO',
        tituloCard3: tipoApuramento === 'RECUPERAR'
          ? '(=) 3. IVA a Recuperar (Crédito Fiscal)'
          : tipoApuramento === 'REEMBOLSO'
          ? '(=) 3. IVA Reembolsos Pedidos'
          : '(=) 3. IVA a Pagar ao Estado',
        rubricaCard3: tipoApuramento === 'RECUPERAR'
          ? 'Conta 34.5.7.1 · Campo 34/39'
          : tipoApuramento === 'REEMBOLSO'
          ? 'Conta 34.5.8.1 · Campo 40'
          : 'Conta 34.5.6.1 · Campo 37',
        incidenciaVendas,
        incidenciaCompras,
        liquidado: {
          contabilidade: itemLiquidado?.contabilidade || '0,00 Kz',
          agt: itemLiquidado?.agt || '0,00 Kz',
          status: (itemLiquidado?.status === 'IGUAIS' || parseValorKz(itemLiquidado?.contabilidade) === parseValorKz(itemLiquidado?.agt)) ? 'IGUAIS' : (itemLiquidado?.status || 'DIFERENÇA'),
          diferenca: itemLiquidado?.diferenca || '0,00 Kz',
        },
        dedutivel: {
          contabilidade: itemDedutivel?.contabilidade || '0,00 Kz',
          agt: itemDedutivel?.agt || '0,00 Kz',
          status: (itemDedutivel?.status === 'IGUAIS' || parseValorKz(itemDedutivel?.contabilidade) === parseValorKz(itemDedutivel?.agt)) ? 'IGUAIS' : (itemDedutivel?.status || 'DIFERENÇA'),
          diferenca: itemDedutivel?.diferenca || '0,00 Kz',
        },
        apuramentoContabilidade,
        apuramentoAgt,
        confrontoPeriodo,
        resultadoPrincipal: tipoApuramento === 'RECUPERAR'
          ? {
              contabilidade: valorAtivoRecuperarContab,
              agt: valorAtivoRecuperarAgt,
              status: statusRecuperar,
              diferenca: diferencaRecuperar,
            }
          : tipoApuramento === 'REEMBOLSO'
          ? (itemReembolso || { contabilidade: '0,00 Kz', agt: '0,00 Kz', status: 'IGUAIS', diferenca: '0,00 Kz' })
          : {
              contabilidade: valorAtivoPagarContab,
              agt: valorAtivoPagarAgt,
              status: statusPagar,
              diferenca: diferencaPagar,
            },
        pagar: {
          contabilidade: valorAtivoPagarContab,
          agt: valorAtivoPagarAgt,
          status: statusPagar,
          diferenca: diferencaPagar,
        },
        recuperar: {
          contabilidade: valorAtivoRecuperarContab,
          agt: valorAtivoRecuperarAgt,
          status: statusRecuperar,
          diferenca: diferencaRecuperar,
        },
        reembolso: itemReembolso
          ? {
              contabilidade: itemReembolso.contabilidade,
              agt: itemReembolso.agt,
              status: itemReembolso.status,
              diferenca: itemReembolso.diferenca,
            }
          : null,
        tresResultadosPGC,
        formula: 'Apuramento do IVA = IVA Liquidado (Vendas ou Serviços) − IVA Dedutível (Compras ou Despesas)',
        notaLegal: tipoApuramento === 'RECUPERAR'
          ? 'A empresa NÃO PAGA IVA neste período: O imposto dedutível supera o liquidado. O crédito apurado acumula e transita como crédito fiscal para o mês seguinte (Artigo 19.º do Código do IVA - Lei n.º 7/19).'
          : 'Imposto a pagar ao Estado: O IVA liquidado supera o dedutível. Valor apurado a liquidar perante a AGT através de DAR até ao último dia do mês legalmente fixado.',
      }
    : null;

  return {
    totalPontos: total,
    iguaisCount: iguaisCount,
    diferencasCount: diferencasCount,
    documentosConfrontados: documentosConfrontados,
    itensConfronto: itensConfronto,
    apuramentoIva: apuramentoIva,
    observacao: observacao,
    diferencasDetalhadas: diferencasDetalhadas,
    pontosIguais: pontosIguais,
    recomendacoes: recomendacoesLista,
    resultadoEsperado: resultadoEsperado,
    analiseTecnicaRaw: analiseTexto,
    recomendacoesRaw: recomendacoesTexto,
    textoOriginal: texto,
  };
}
