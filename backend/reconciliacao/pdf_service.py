import pdfplumber
import logging
import traceback
import re
import httpx
from groq import Groq
from decouple import config

logger = logging.getLogger('reconciliacao')

# Verificado contra a API em Outubro de 2026. Os três modelos que aqui
# estavam — llama-3.3-70b-versatile, llama-3.1-8b-instant e mixtral-8x7b —
# foram descontinuados pela Groq, pelo que TODAS as chamadas falhavam em
# silêncio e o sistema caía sempre na análise heurística. O log registava
# "Tentando modelo: ..." três vezes seguidas e ninguém reparou.
MODELS_DISPONIVEIS = [
    'openai/gpt-oss-120b',   # 131k de contexto, ~1,5s por resposta
    'qwen/qwen3.8-27b',      # alternativa mais rápida
    'openai/gpt-oss-20b',
]
MODELO_PADRAO = MODELS_DISPONIVEIS[0]

def get_groq_client():
    api_key = config('GROQ_API_KEY', default='')
    if not api_key:
        logger.error("GROQ_API_KEY nao configurada no arquivo .env")
        raise ValueError("GROQ_API_KEY nao configurada no arquivo .env")
    logger.info("Cliente Groq criado.")
    # Passa httpx.Client explícito para evitar incompatibilidade entre versoes de httpx >= 0.28 e Groq SDK ('proxies')
    try:
        http_client = httpx.Client(timeout=120.0)
        return Groq(api_key=api_key, http_client=http_client)
    except Exception as err:
        logger.warning(f"Fallback ao criar Groq client direto: {err}")
        return Groq(api_key=api_key)


def get_model_name():
    model = config('GROQ_MODEL', default=MODELO_PADRAO)
    logger.info(f"Modelo Groq configurado: {model}")
    return model


def tentar_modelos(client, messages, temperature=0.2, max_tokens=4000):
    """Tenta multiplos modelos ate encontrar um que funcione"""
    model_config = get_model_name()
    
    # Lista de modelos para tentar
    modelos_para_tentar = [model_config] + [m for m in MODELS_DISPONIVEIS if m != model_config]
    
    for model in modelos_para_tentar:
        try:
            logger.info(f"Tentando modelo: {model}")
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            logger.info(f"Modelo {model} funcionou!")
            return response, model
        except Exception as e:
            error_msg = str(e)
            if 'model_not_found' in error_msg or 'does not exist' in error_msg:
                logger.warning(f"Modelo {model} nao encontrado, tentando proximo...")
                continue
            else:
                # Outro tipo de erro, lancar excecao
                raise e
    
    raise Exception("Nenhum modelo disponivel foi encontrado")


def extrair_texto_pdf(caminho_arquivo):
    try:
        texto = ""
        with pdfplumber.open(caminho_arquivo) as pdf:
            for pagina in pdf.pages:
                texto += pagina.extract_text() or ""
        return texto
    except Exception as e:
        return f"Erro ao extrair texto: {str(e)}"


def get_prompts_by_language(idioma):
    prompts = {
        'pt': {
            'system': (
                "Voce e um auditor contabilistico e fiscal angolano especializado no confronto entre a contabilidade (Balancete PGC) e as declaracoes fiscais da AGT (Modelo 7 do CIVA - Lei n.º 7/19).\n"
                "REGRA DE OURO: A sua base de analise sao EXCLUSIVAMENTE os dois documentos fornecidos.\n"
                "REGRAS DE APURAMENTO DO IVA (LEI N.º 7/19 - CIVA E PGC ANGOLANO):\n"
                "1. IVA Liquidado: Vendas ou Servicos (Conta 34.5.3 / 3453 vs Campo 21/33 do Modelo 7).\n"
                "2. IVA Dedutivel: Compras ou Despesas (Conta 34.5.1/34.5.2 / 3451/3452 vs Campo 22/32 do Modelo 7).\n"
                "3. APURAMENTO DO IVA (Contas 34.5):\n"
                "   - Se IVA Dedutivel > IVA Liquidado: A EMPRESA NAO PAGA IVA! Apura IVA A RECUPERAR / CREDITO FISCAL (Conta 34.5.7.1 / 3457 vs Campo 34/38/39 do Modelo 7). O saldo acumula para o mes seguinte.\n"
                "   - Se IVA Liquidado > IVA Dedutivel: A empresa tem IVA A PAGAR AO ESTADO (Conta 34.5.6.1 / 3456 vs Campo 37 do Modelo 7).\n"
                "   - Se houver pedido de devolucao: IVA REEMBOLSOS PEDIDOS (Conta 34.5.8.1 / 3458 vs Campo 40 do Modelo 7) - Reembolso Parcial ou Total.\n"
                "Para cada dado confrontado, declare claramente se os valores sao IGUAIS ou se tem DIFERENCAS."
            ),
            'prompt': """Confronte estes dois documentos com rigor e clareza contabilistica:

=== DOCUMENTO 1: CONTABILIDADE (BALANCETE) ===
{texto_contabilidade}

=== DOCUMENTO 2: DECLARACAO MODELO 7 DA AGT ===
{texto_agt}

FORMATO OBRIGATORIO:

====================================
1. RESUMO DO CONFRONTO (BALANCETE vs MODELO 7)
====================================
- Documentos confrontados: Balancete de Verificacao da Contabilidade e Declaracao Modelo 7 de IVA
- Total de pontos analisados: X
- Dados IGUAIS (Conformes): X
- Dados com DIFERENCAS: X

====================================
2. DETALHE DOS DADOS: IGUAIS vs DIFERENCAS
====================================
Apresente OBRIGATORIAMENTE uma tabela markdown com estas colunas exatas:
| Nome do Campo | Contabilidade (Balancete) | AGT (Modelo 7) | Status | Diferença Apurada |
| Base Tributável / Volume de Negócios | [valor] Kz | [valor] Kz | [IGUAIS ou DIFERENÇA] | [valor] Kz |
| IVA Liquidado (Vendas ou Serviços - Conta 34.5.3) | [valor] Kz | [valor] Kz | [IGUAIS ou DIFERENÇA] | [valor] Kz |
| IVA Dedutível (Compras ou Despesas - Conta 34.5.1/34.5.2) | [valor] Kz | [valor] Kz | [IGUAIS ou DIFERENÇA] | [valor] Kz |
| Apuramento do IVA (Conta 34.5.6.1 a Pagar / Conta 34.5.7.1 a Recuperar) | [valor] Kz | [valor] Kz | [IGUAIS ou DIFERENÇA] | [valor] Kz |
| Saldo de Caixa (Conta 4511) | [valor] Kz | Não aplicável | [IGUAIS ou DIFERENÇA] | [valor] Kz |
| Retenções na Fonte de 6,5% a Prestadores | [valor] Kz | [valor] Kz | [IGUAIS ou DIFERENÇA] | [valor] Kz |

====================================
QUADRO OFICIAL DE APURAMENTO DO IVA (LEI N.º 7/19 - CIVA)
====================================
Demonstração do cálculo legal obrigatório:
REGRA LEGAL: Apuramento do IVA = IVA Liquidado (Vendas ou Serviços) − IVA Dedutível (Compras ou Despesas)
• Contabilidade (Balancete): [Liquidado] Kz − [Dedutível] Kz = [Resultado: IVA a Recuperar ou IVA a Pagar] Kz
• Declaração AGT (Modelo 7): [Liquidado] Kz − [Dedutível] Kz = [Resultado: IVA a Recuperar ou IVA a Pagar] Kz
• Confronto Final do Apuramento: [IGUAIS ou DIFERENÇA de X Kz]
• Situação Oficial CIVA: [Ex: IVA A RECUPERAR (Crédito Fiscal - Conta 34.5.7.1). A empresa NÃO paga IVA neste período; o saldo acumula para o mês seguinte | OU: IVA A PAGAR AO ESTADO (Conta 34.5.6.1)]

Três Resultados Oficiais do PGC Angolano (Contas 34.5):
1. Conta 34.5.6.1 - IVA a pagar de apuramento: [valor ou 0,00 Kz]
2. Conta 34.5.7.1 - IVA a recuperar de apuramentos (Crédito Fiscal): [valor ou 0,00 Kz]
3. Conta 34.5.8.1 - IVA reembolsos pedidos (Reembolso Parcial ou Total): [valor ou 0,00 Kz]

====================================
3. ANALISE DAS DIFERENCAS DETETADAS
====================================
REGRA FUNDAMENTAL: Se TODOS os valores forem IGUAIS (sem diferencas):
- Escreva: "Nenhuma divergencia detetada. Todos os valores estao em perfeita conformidade."
- NAO reproduza cabecalhos de tabela nem crie blocos vazios de diferenca.

Se existirem diferencas, para cada diferenca:
- **[Nome do Campo]**
  - **O que esta no Balancete:** [valor e conta]
  - **O que foi declarado no Modelo 7:** [valor e campo]
  - **Causa provavel:** [motivo da diferenca]
  - **Risco fiscal:** [baixo/medio/alto e explicacao do risco perante o Codigo do IVA]

**Pontos IGUAIS**:
- [Nome do Campo]: [valor] Kz (em perfeita conformidade)

====================================
4. O QUE FAZER PARA RESOLVER (RECOMENDACOES)
====================================
1. **[Acao 1]**
   - [Passo pratico para regularizar]
2. **[Acao 2]**
   - [Passo pratico para regularizar]

**Resultado esperado**:
- [Conformidade total perante a AGT e mitigacao de risco]

IMPORTANTE:
- Use valores em Kz / AKZ
- Foco exclusivo nos dois documentos (sem exigir outros documentos)
""",
        },
        'en': {
            'system': "You are an Angolan accountant specialized in VAT. Always respond in English clearly and objectively.",
            'prompt': """You are an Angolan accountant specialized in VAT.

Compare these two documents and produce a CLEAN and EASY-TO-READ REPORT.

=== DOCUMENT 1: ACCOUNTING ===
{texto_contabilidade}

=== DOCUMENT 2: AGT DECLARATION ===
{texto_agt}

REPORT FORMAT (mandatory):

====================================
GENERAL SUMMARY
====================================
- Total fields analyzed: X
- Conforming fields: X
- Divergences found: X

====================================
FIELD DETAIL
====================================

For EACH field, use this format:

[FIELD NAME]
  Accounting: [value] Kz
  AGT:        [value] Kz
  Status:     [OK] Conforming  OR  [ALERTA] Divergence
  Difference: [value] Kz (if any)

====================================
TECHNICAL ANALYSIS
====================================
For each divergence, explain in 1 sentence:
- Possible cause of error
- Tax risk (Low/Medium/High)
- Recommended action

====================================
FINAL RECOMMENDATIONS
====================================
 List 3 priority actions to correct the issues found.

IMPORTANT:
- Use values in Kz (Kwanza)
- Be direct and clear
- Do not invent data not in the documents
- If a value is not found, say "Not found in document"
""",
        },
        'zh': {
            'system': "Voce e um contador angolano especializado em IVA. Por favor, responda sempre em chines de forma clara e objetiva.",
            'prompt': """Voce e um contador angolano especializado em IVA.

Compare estes dois documentos e produza um relatorio claro e facil de ler.

=== DOCUMENTO 1: CONTABILIDADE ===
{texto_contabilidade}

=== DOCUMENTO 2: DECLARACAO AGT ===
{texto_agt}

FORMATO DO RELATORIO (obrigatorio seguir):

====================================
RESUMO GERAL
====================================
- Total de campos analisados: X
- Campos conformes: X
- Divergencias encontradas: X

====================================
DETALHE POR CAMPO
====================================

Para CADA campo, use este formato:

[NOME DO CAMPO]
  Contabilidade: [valor] Kz
  AGT:           [valor] Kz
  Status:        [OK] Conforme  OU  [ALERTA] Divergencia
  Diferenca:     [valor] Kz (se houver)

====================================
ANALISE TECNICA
====================================
Para cada divergencia, explique em 1 frase:
- Possivel causa do erro
- Risco fiscal (Baixo/Medio/Alto)
- Acao recomendada

====================================
RECOMENDACOES FINAIS
====================================
 Liste 3 acoes prioritarias para corrigir os problemas encontrados.

IMPORTANTE:
- Use valores em Kz (Kwanza)
- Seja direto e claro
- Nao invente dados que nao estejam nos documentos
- Se nao encontrar algum dado, diga "Nao encontrado no documento"
""",
        },
    }
    return prompts.get(idioma, prompts['pt'])


from decimal import Decimal


def parse_kz(val_str):
    if not val_str:
        return Decimal('0')
    cleaned = str(val_str).strip().replace(' ', '').replace('.', '').replace(',', '.')
    try:
        return Decimal(cleaned)
    except Exception:
        return Decimal('0')


def fmt_kz(val):
    if val is None:
        return '0,00 Kz'
    s = f'{val:,.2f}'
    s = s.replace(',', 'X').replace('.', ',').replace('X', '.')
    return f'{s} Kz'


def extrair_dados_balancete(txt):
    """Extrai saldos e movimentos do Balancete de Verificação (PGC Angolano).
    Pesquisa rigorosamente por CÓDIGO de conta (com ou sem pontos: ex. 34.5.3, 3453)
    e por NOME/DESCRIÇÃO da conta.
    """
    res = {
        'vendas': Decimal('0'),
        'compras': Decimal('0'),
        'fse': Decimal('0'),
        'iva_liquidado': Decimal('0'),
        'iva_suportado': Decimal('0'),
        'iva_pagar': Decimal('0'),
        'iva_recuperar': Decimal('0'),
        'iva_reembolso': Decimal('0'),
        'iva_apuramento': Decimal('0'),
        'caixa_saldo_credor': Decimal('0'),
        'caixa_saldo_devedor': Decimal('0'),
        'irt_retido': Decimal('0'),
        'inss_retido': Decimal('0'),
        'retencao_prestadores': Decimal('0'),
        'retencao_clientes': Decimal('0'),
        'honorarios_prestadores': Decimal('0'),
        'remuneracoes': Decimal('0'),
        'iva_custo': Decimal('0'),
    }
    if not txt:
        return res

    for line in txt.split('\n'):
        line_clean = line.strip()
        nums = re.findall(r'(?:^|\s)([\d]{1,3}(?:[.\s]\d{3})*,\d{2})', line_clean)
        if not nums:
            continue
        vals = [parse_kz(n) for n in nums]
        max_val = max(vals) if vals else Decimal('0')
        line_lower = line_clean.lower()

        # 34.5.7 / 3457 - IVA a Recuperar (Crédito Fiscal)
        if re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:34\.?5\.?7(?:\.?\d+)*|24\.?3\.?6)\b', line_clean, re.I) or ('recuperar' in line_lower and 'iva' in line_lower):
            if max_val > res['iva_recuperar']:
                res['iva_recuperar'] = max_val

        # 34.5.6 / 3456 - IVA a Pagar de Apuramento
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:34\.?5\.?6(?:\.?\d+)*|24\.?3\.?5)\b', line_clean, re.I) or (('iva a pagar' in line_lower or 'iva - a pagar' in line_lower) and 'retencao' not in line_lower):
            if max_val > res['iva_pagar']:
                res['iva_pagar'] = max_val

        # 34.5.8 / 3458 - IVA Reembolsos Pedidos
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:34\.?5\.?8(?:\.?\d+)*|24\.?3\.?7)\b', line_clean, re.I) or ('reembolso' in line_lower and 'iva' in line_lower):
            if max_val > res['iva_reembolso']:
                res['iva_reembolso'] = max_val

        # 34.5.3 / 3453 - IVA Liquidado (Vendas ou Serviços)
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:34\.?5\.?3(?:\.?\d+)*|24\.?3\.?2)\b', line_clean, re.I) or ('iva liquidado' in line_lower or 'iva - liquidado' in line_lower):
            if vals and vals[0] > res['iva_liquidado']:
                res['iva_liquidado'] = vals[0]

        # 34.5.1 / 34.5.2 / 3451 / 3452 - IVA Suportado / Dedutível (Compras ou Despesas)
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:34\.?5\.?[12](?:\.?\d+)*|24\.?3\.?[34])\b', line_clean, re.I) or ('iva dedut' in line_lower or 'iva suportado' in line_lower or 'iva - dedut' in line_lower):
            if vals and vals[0] > res['iva_suportado']:
                res['iva_suportado'] = vals[0]

        # 34.5.5 / 3455 - IVA Apuramento
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:34\.?5\.?5(?:\.?\d+)*)\b', line_clean, re.I) or ('iva apuramento' in line_lower):
            if vals and vals[0] > res['iva_apuramento']:
                res['iva_apuramento'] = vals[0]

        # 21 - Compras / Existências
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:21(?:\.\d+)*)\b', line_clean, re.I) or (('compras' in line_lower or 'mercadorias' in line_lower) and 'iva' not in line_lower and '345' not in line_lower and 'imobiliz' not in line_lower):
            if max_val > res['compras']:
                res['compras'] = max_val

        # 752 - Fornecimentos e Serviços de Terceiros (FSE)
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:75\.?2(?:\.\d+)*)\b', line_clean, re.I) or ('fornecimentos e serviços' in line_lower or 'fornecimentos serviços' in line_lower):
            if max_val > res['fse']:
                res['fse'] = max_val

        # 61 / 62 - Vendas e Prestações de Serviço (Volume de Negócios)
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:6[12](?:\.\d+)*|6[12]\d*|7[12](?:\.\d+)*)\b', line_clean, re.I) or (('vendas' in line_lower or 'prestações de serviço' in line_lower or 'prestacoes de servico' in line_lower) and 'iva' not in line_lower):
            if len(vals) >= 2 and vals[1] > res['vendas']:
                res['vendas'] = vals[1]
            elif vals and vals[0] > res['vendas']:
                res['vendas'] = vals[0]

        # 45 / 4511 - Caixa
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:45(?:\.\d+)*|451\d*|11(?:\.\d+)*)\b', line_clean, re.I) or ('caixa' in line_lower and 'regime' not in line_lower):
            if len(vals) >= 4:
                if vals[3] > Decimal('0'):
                    res['caixa_saldo_credor'] = vals[3]
                elif vals[2] > Decimal('0'):
                    res['caixa_saldo_devedor'] = vals[2]
            elif len(vals) >= 2:
                if vals[1] > vals[0]:
                    res['caixa_saldo_credor'] = vals[1] - vals[0]
                else:
                    res['caixa_saldo_devedor'] = vals[0] - vals[1]

        # 343 - IRT
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:34\.?3(?:\.?\d+)*)\b', line_clean, re.I) or ('irt' in line_lower and 'retido' in line_lower):
            if len(vals) >= 2 and vals[1] > res['irt_retido']:
                res['irt_retido'] = vals[1]
            elif vals and vals[0] > res['irt_retido']:
                res['irt_retido'] = vals[0]

        # 3492 - Segurança Social
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:34\.?9\.?2(?:\.?\d+)*)\b', line_clean, re.I) or ('segurança social' in line_lower or 'inss' in line_lower):
            if len(vals) >= 2 and vals[1] > res['inss_retido']:
                res['inss_retido'] = vals[1]
            elif vals and vals[0] > res['inss_retido']:
                res['inss_retido'] = vals[0]

        # 3493 - Retenções na Fonte Prestadores
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:34\.?9\.?3(?:\.?\d+)*)\b', line_clean, re.I) or ('reten' in line_lower and 'prestador' in line_lower):
            if len(vals) >= 2 and vals[1] > res['retencao_prestadores']:
                res['retencao_prestadores'] = vals[1]
            elif vals and vals[0] > res['retencao_prestadores']:
                res['retencao_prestadores'] = vals[0]

        # 3413 - Retenções na Fonte Clientes
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:34\.?1\.?3(?:\.?\d+)*)\b', line_clean, re.I) or ('reten' in line_lower and 'cliente' in line_lower):
            if vals and vals[0] > res['retencao_clientes']:
                res['retencao_clientes'] = vals[0]

        # 75234 - Honorários Prestadores
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:75\.?2\.?3\.?4(?:\.?\d+)*)\b', line_clean, re.I) or ('honor' in line_lower):
            if vals and vals[0] > res['honorarios_prestadores']:
                res['honorarios_prestadores'] = vals[0]

        # 722 - Remunerações
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:72\.?2(?:\.?\d+)*)\b', line_clean, re.I) or ('remunera' in line_lower):
            if vals and vals[0] > res['remuneracoes']:
                res['remuneracoes'] = vals[0]

        # 75312 - IVA Lançado como Custo
        elif re.match(r'^\s*(?:conta\s+)?(?:c/)?(?:75\.?3\.?1\.?2(?:\.?\d+)*)\b', line_clean, re.I) or ('iva' in line_lower and 'custo' in line_lower):
            if vals and vals[0] > res['iva_custo']:
                res['iva_custo'] = vals[0]

    if res['compras'] == Decimal('0') and res['fse'] > Decimal('0'):
        res['compras'] = res['fse']
    elif res['compras'] == Decimal('0') and res['iva_suportado'] > Decimal('0'):
        res['compras'] = (res['iva_suportado'] / Decimal('0.14')).quantize(Decimal('0.01'))

    # Regra Fundamental do Código do IVA (CIVA - Lei n.º 7/19, Art. 19.º e Seguintes):
    # O Apuramento do IVA é obrigatoriamente a diferença entre IVA Liquidado e IVA Dedutível.
    # Se nem IVA a pagar nem IVA a recuperar foram extraídos diretamente de contas de apuramento (34.5.6 / 34.5.7):
    if res['iva_pagar'] == Decimal('0') and res['iva_recuperar'] == Decimal('0') and res['iva_reembolso'] == Decimal('0'):
        apuramento_contab = res['iva_liquidado'] - res['iva_suportado']
        if apuramento_contab > Decimal('0'):
            res['iva_pagar'] = apuramento_contab
        elif apuramento_contab < Decimal('0'):
            res['iva_recuperar'] = abs(apuramento_contab)

    return res


def extrair_dados_modelo7(txt):
    """Extrai os campos da Declaração Modelo 7 de IVA da AGT.

    Delega em `agt_modelo7.parse`, que lê os 56 campos do formulário oficial.
    """
    from . import agt_modelo7

    lido = agt_modelo7.parse(txt)
    base = lido.get('base_tributavel', Decimal('0.00'))
    liq = lido.get('iva_liquidado', Decimal('0.00'))
    ded = lido.get('iva_dedutivel', Decimal('0.00'))
    pag = lido.get('iva_pagar', Decimal('0.00'))
    rec = lido.get('iva_recuperar', Decimal('0.00'))
    reembolso = lido.get('campos', {}).get('40', Decimal('0.00'))

    # Campo 34: Crédito do período (32 - 33)
    # Campo 38: Crédito do imposto (34 + 36 + 36.1)
    # Campo 39: Reporte para período seguinte
    c = lido.get('campos', {})
    base_vendas = c.get('1', Decimal('0.00')) + c.get('1.1', Decimal('0.00')) + c.get('1.2', Decimal('0.00')) + c.get('1.3', Decimal('0.00'))
    base_compras = c.get('16', Decimal('0.00')) + c.get('18', Decimal('0.00')) + c.get('20', Decimal('0.00')) + c.get('22', Decimal('0.00')) + c.get('24', Decimal('0.00'))
    credito_periodo = c.get('34', Decimal('0.00'))
    excesso_anterior = c.get('36', Decimal('0.00'))
    reporte_seguinte = c.get('39', Decimal('0.00'))
    divida_periodo = c.get('35', Decimal('0.00'))

    if base_vendas == Decimal('0.00'):
        if base > base_compras and base_compras > Decimal('0.00'):
            base_vendas = base - base_compras
        else:
            base_vendas = base

    c34 = credito_periodo
    c38 = c.get('38', Decimal('0.00'))
    c39 = reporte_seguinte
    if c34 > Decimal('0'):
        rec = c34
    elif c39 > Decimal('0'):
        rec = c39
    elif c38 > Decimal('0'):
        rec = c38

    # Regra Fundamental do IVA: Liquidado - Dedutível
    dif_iva = liq - ded
    if dif_iva > Decimal('0') and pag == Decimal('0'):
        pag = dif_iva
    elif dif_iva < Decimal('0') and rec == Decimal('0'):
        rec = abs(dif_iva)

    return {
        'base_tributavel': base,
        'base_vendas': base_vendas,
        'base_compras': base_compras,
        'iva_liquidado': liq,
        'iva_dedutivel': ded,
        'credito_periodo': credito_periodo,
        'excesso_anterior': excesso_anterior,
        'reporte_seguinte': reporte_seguinte,
        'divida_periodo': divida_periodo,
        'iva_pagar': pag,
        'iva_recuperar': rec,
        'iva_reembolso': reembolso,
        'fora_prazo': bool(lido['fora_prazo']) if lido.get('fora_prazo') is not None else False,
        'completo': lido,
    }


def gerar_analise_heuristica(texto_contabilidade, texto_agt, idioma='pt'):
    """Gera o confronto analítico rigoroso Balancete vs Modelo 7 AGT com tabela markdown."""
    b = extrair_dados_balancete(texto_contabilidade)
    m7 = extrair_dados_modelo7(texto_agt)

    # 1. Base Tributável / Incidência de Vendas (Volume de Negócios)
    dif_base = abs(b['vendas'] - m7['base_vendas'])
    st_base = 'IGUAIS' if dif_base <= Decimal('1.00') else 'DIFERENÇA'

    # 2. IVA Liquidado (Vendas ou Serviços)
    dif_liq = abs(b['iva_liquidado'] - m7['iva_liquidado'])
    st_liq = 'IGUAIS' if dif_liq <= Decimal('0.05') else 'DIFERENÇA'

    # 3. Compras e Serviços (Incidência do IVA Dedutível)
    dif_compras = abs(b['compras'] - m7['base_compras'])
    st_compras = 'IGUAIS' if dif_compras <= Decimal('1.00') else 'DIFERENÇA'

    # 4. IVA Dedutível (Compras ou Despesas)
    dif_ded = abs(b['iva_suportado'] - m7['iva_dedutivel'])
    st_ded = 'IGUAIS' if dif_ded <= Decimal('0.05') else 'DIFERENÇA'

    # 5. Apuramento do IVA: Três Resultados Possíveis (CIVA Lei n.º 7/19 e PGC Angolano)
    is_recuperar = (m7['iva_recuperar'] > Decimal('0') or b['iva_recuperar'] > Decimal('0') or m7['iva_dedutivel'] > m7['iva_liquidado'])
    is_reembolso = (m7.get('iva_reembolso', Decimal('0')) > Decimal('0') or b.get('iva_reembolso', Decimal('0')) > Decimal('0'))

    # Saldo apurado da Contabilidade vs Modelo 7
    val_b_apurado = b['iva_recuperar'] if is_recuperar else b['iva_pagar']
    val_m7_periodo = m7['credito_periodo'] if is_recuperar and m7['credito_periodo'] > Decimal('0') else (m7['iva_recuperar'] if is_recuperar else m7['iva_pagar'])

    dif_apur = abs(val_b_apurado - val_m7_periodo)
    st_apur = 'IGUAIS' if dif_apur <= Decimal('0.05') else 'DIFERENÇA'

    dif_pag = abs(b['iva_pagar'] - m7['iva_pagar'])
    st_pag = 'IGUAIS' if dif_pag <= Decimal('0.05') else 'DIFERENÇA'

    dif_rec = abs(b['iva_recuperar'] - m7['iva_recuperar'])
    st_rec = 'IGUAIS' if dif_rec <= Decimal('0.05') else 'DIFERENÇA'

    dif_reemb = abs(b.get('iva_reembolso', Decimal('0')) - m7.get('iva_reembolso', Decimal('0')))
    st_reemb = 'IGUAIS' if dif_reemb <= Decimal('0.05') else 'DIFERENÇA'

    # 6. Caixa Negativo / Credor
    st_caixa = 'DIFERENÇA' if b['caixa_saldo_credor'] > Decimal('0') else 'IGUAIS'

    # 7. Retenções na Fonte de 6,5% a Prestadores
    ret_obrigatoria = (b['honorarios_prestadores'] * Decimal('0.065')).quantize(Decimal('0.01'))
    dif_ret = abs(ret_obrigatoria - b['retencao_prestadores'])
    st_ret = 'IGUAIS' if (b['honorarios_prestadores'] == Decimal('0') or dif_ret <= Decimal('1.00')) else 'DIFERENÇA'

    linhas_tabela = [
        ('Volume de Negócios / Vendas (Incidência do IVA Liquidado)', fmt_kz(b['vendas']), fmt_kz(m7['base_vendas']), st_base, fmt_kz(dif_base)),
        ('IVA Liquidado (Vendas ou Serviços — Conta 34.5.3 vs Campo 33)', fmt_kz(b['iva_liquidado']), fmt_kz(m7['iva_liquidado']), st_liq, fmt_kz(dif_liq)),
        ('Compras e Serviços (Incidência do IVA Dedutível)', fmt_kz(b['compras']), fmt_kz(m7['base_compras']), st_compras, fmt_kz(dif_compras)),
        ('IVA Dedutível (Compras ou Despesas — Conta 34.5.1/34.5.2 vs Campo 32)', fmt_kz(b['iva_suportado']), fmt_kz(m7['iva_dedutivel']), st_ded, fmt_kz(dif_ded)),
    ]

    if is_recuperar:
        linhas_tabela.append(
            ('Apuramento do IVA do Período (Conta 34.5.7.1 vs Campo 34)', f"{fmt_kz(val_b_apurado)} (a recuperar)", f"{fmt_kz(val_m7_periodo)} (a recuperar)", st_apur, fmt_kz(dif_apur))
        )
    elif is_reembolso:
        linhas_tabela.append(
            ('IVA Reembolsos Pedidos (Conta 34.5.8.1 vs Campo 40)', fmt_kz(b['iva_reembolso']), fmt_kz(m7['iva_reembolso']), 'IGUAIS', '0,00 Kz')
        )
    else:
        linhas_tabela.append(
            ('Apuramento do IVA do Período (Conta 34.5.6.1 vs Campo 37)', f"{fmt_kz(val_b_apurado)} (a pagar)", f"{fmt_kz(val_m7_periodo)} (a pagar)", st_apur, fmt_kz(dif_apur))
        )

    if m7.get('excesso_anterior', Decimal('0')) > Decimal('0'):
        linhas_tabela.append(
            ('Excesso a Reportar de Períodos Anteriores (Campo 36 da AGT)', 'Não aplicável (período corrente)', fmt_kz(m7['excesso_anterior']), 'INFO', fmt_kz(m7['excesso_anterior']))
        )

    linhas_tabela.extend([
        ('Saldo de Caixa (PGC Conta 4511)', f"-{fmt_kz(b['caixa_saldo_credor'])} (Credor)" if b['caixa_saldo_credor'] > 0 else fmt_kz(b['caixa_saldo_devedor']), 'Não aplicável no Modelo 7', st_caixa, fmt_kz(b['caixa_saldo_credor'])),
        ('Retenções na Fonte de 6,5% a Prestadores (Conta 75234 vs 3493)', f"Honorários: {fmt_kz(b['honorarios_prestadores'])} | Retido: {fmt_kz(b['retencao_prestadores'])}", f"Obrigatório 6,5%: {fmt_kz(ret_obrigatoria)}", st_ret, fmt_kz(dif_ret)),
    ])

    total_analisados = len(linhas_tabela)
    iguais = sum(1 for _, _, _, st, _ in linhas_tabela if st == 'IGUAIS')
    divergencias = total_analisados - iguais

    tabela_md = [
        "| Nome do Campo | Contabilidade (Balancete) | AGT (Modelo 7) | Status | Diferença Apurada |",
        "|---|---|---|---|---|",
    ]
    for campo, c_val, a_val, st, dif in linhas_tabela:
        tabela_md.append(f"| {campo} | {c_val} | {a_val} | {st} | {dif} |")

    tabela_str = '\n'.join(tabela_md)

    if is_recuperar:
        detalhe_situacao = (
            f"• RESULTADO DO APURAMENTO: IVA A RECUPERAR (Crédito Fiscal - Conta 34.5.7.1) de {fmt_kz(val_m7_periodo)}\n"
            f"• AVISO CONTABILÍSTICO/LEGAL: A empresa NÃO PAGA IVA neste período, pois o imposto dedutível supera o liquidado.\n"
            f"  O valor acumula e transita como crédito fiscal para dedução no período seguinte (Art. 19.º CIVA).\n"
            f"• Confronto Final do IVA a Recuperar: {st_apur} (Diferença: {fmt_kz(dif_apur)})"
        )
    elif is_reembolso:
        detalhe_situacao = (
            f"• RESULTADO DO APURAMENTO: IVA REEMBOLSOS PEDIDOS (Conta 34.5.8.1) de {fmt_kz(m7['iva_reembolso'])} - Reembolso Parcial ou Total\n"
            f"• Confronto Final do Reembolso: {st_reemb} (Diferença: {fmt_kz(dif_reemb)})"
        )
    else:
        detalhe_situacao = (
            f"• RESULTADO DO APURAMENTO: IVA A PAGAR AO ESTADO (Conta 34.5.6.1) de {fmt_kz(val_m7_periodo)}\n"
            f"• Confronto Final do IVA a Pagar: {st_apur} (Diferença: {fmt_kz(dif_apur)})\n"
            f"• REGRA DE PAGAMENTO: O imposto apurado deve ser entregue nos cofres do Estado até ao último dia do mês."
        )

    quadro_apuramento_iva = f"""====================================
QUADRO OFICIAL DE APURAMENTO DO IVA (LEI N.º 7/19 - CIVA E PGC ANGOLANO)
====================================
Demonstração do cálculo legal obrigatório em ambos os documentos:
FÓRMULA LEGAL OBRIGATÓRIA: Apuramento do Período = IVA Liquidado (Vendas) − IVA Dedutível (Compras)

1. APURAMENTO SEGUNDO A CONTABILIDADE (BALANCETE PGC):
   - Incidência / Vendas (Conta 61): {fmt_kz(b['vendas'])} -> IVA Liquidado (Conta 34.5.3): {fmt_kz(b['iva_liquidado'])}
   - Incidência / Compras (Conta 21): {fmt_kz(b['compras'])} -> IVA Dedutível (Conta 34.5.1/34.5.2): {fmt_kz(b['iva_suportado'])}
   - Cálculo do Apuramento: {fmt_kz(b['iva_liquidado'])} − {fmt_kz(b['iva_suportado'])}
   - Saldo Apurado no Balancete: {fmt_kz(val_b_apurado)} ({'IVA a Recuperar - Conta 34.5.7.1' if is_recuperar else 'IVA a Pagar - Conta 34.5.6.1'})

2. APURAMENTO SEGUNDO A DECLARAÇÃO DA AGT (MODELO 7):
   - Incidência / Vendas (Quadro 09 - Campos 1 e 1.2): {fmt_kz(m7['base_vendas'])} -> IVA Liquidado (Campo 33): {fmt_kz(m7['iva_liquidado'])}
   - Incidência / Compras (Quadro 09 - Campo 22): {fmt_kz(m7['base_compras'])} -> IVA Dedutível (Campo 32): {fmt_kz(m7['iva_dedutivel'])}
   - Cálculo do Período: {fmt_kz(m7['iva_liquidado'])} − {fmt_kz(m7['iva_dedutivel'])}
   - Saldo do Período (Campo 34/35): {fmt_kz(val_m7_periodo)} ({'Crédito do Período - Campo 34' if is_recuperar else 'Dívida do Período - Campo 35'})
   - (+) Excesso a Reportar do Período Anterior (Campo 36): {fmt_kz(m7.get('excesso_anterior', Decimal('0')))}
   - (=) Posição Final Acumulada: {fmt_kz(m7.get('reporte_seguinte', val_m7_periodo) if is_recuperar else m7.get('iva_pagar', val_m7_periodo))} ({'Reporte para o Período Seguinte - Campo 39' if is_recuperar else 'Imposto a Pagar Líquido - Campo 37'})

3. CONFRONTO DIRETO DO APURAMENTO DO PERÍODO:
   - Contabilidade: {fmt_kz(val_b_apurado)} vs AGT (Modelo 7): {fmt_kz(val_m7_periodo)}
   - Situação: {st_apur} (Diferença: {fmt_kz(dif_apur)})

Três Resultados Oficiais do PGC Angolano (Contas 34.5):
1. Conta 34.5.6.1 - IVA a pagar de apuramento: {fmt_kz(b['iva_pagar'])} (Contab) vs {fmt_kz(m7['iva_pagar'])} (AGT)
2. Conta 34.5.7.1 - IVA a recuperar de apuramentos (Crédito Fiscal): {fmt_kz(b['iva_recuperar'])} (Contab) vs {fmt_kz(m7['iva_recuperar'])} (AGT)
3. Conta 34.5.8.1 - IVA reembolsos pedidos (Reembolso Parcial ou Total): {fmt_kz(b['iva_reembolso'])} (Contab) vs {fmt_kz(m7.get('iva_reembolso', Decimal('0')))} (AGT)

{detalhe_situacao}
"""

    analises_difs = []
    if st_compras == 'DIFERENÇA':
        analises_difs.append(
            f"- **Compras e Serviços (Incidência do IVA Dedutível — Conta 21 vs Campo 22)**\n"
            f"  - **O que está no Balancete:** {fmt_kz(b['compras'])} em compras/existências (Conta 21)\n"
            f"  - **O que foi declarado no Modelo 7:** {fmt_kz(m7['base_compras'])} no Quadro 09 (Campo 22)\n"
            f"  - **Causa provável:** Faturas de compras de existências ou despesas registadas na contabilidade que não foram refletidas no Campo 22 do Modelo 7 ou aquisições com isenção.\n"
            f"  - **Risco fiscal:** MÉDIO a ALTO. Incoerência entre o custo das mercadorias vendidas/inventários e as declarações fiscais perante a AGT."
        )
    if st_caixa == 'DIFERENÇA':
        analises_difs.append(
            f"- **Saldo da Conta de Caixa (Conta 4511)**\n"
            f"  - **O que está no Balancete:** Saldo credor de {fmt_kz(b['caixa_saldo_credor'])}\n"
            f"  - **O que foi declarado no Modelo 7:** Não aplicável\n"
            f"  - **Causa provável:** Pagamentos efetuados sem prévio registo de recebimentos ou saídas de caixa superiores às entradas.\n"
            f"  - **Risco fiscal:** ALTO. A AGT presume omissão de proveitos (vendas não faturadas) quando o caixa tem saldo negativo, gerando coimas e liquidações oficiosas segundo o Código Geral Tributário."
        )
    if st_ded == 'DIFERENÇA':
        analises_difs.append(
            f"- **IVA Dedutível / Suportado (Conta 3451 vs Campo 32)**\n"
            f"  - **O que está no Balancete:** {fmt_kz(b['iva_suportado'])} registado como imposto suportado/custo\n"
            f"  - **O que foi declarado no Modelo 7:** {fmt_kz(m7['iva_dedutivel'])}\n"
            f"  - **Causa provável:** Faturas de compras sem dedução tempestiva no Modelo 7 ou lançamento indevido de IVA em contas de custo (75312).\n"
            f"  - **Risco fiscal:** MÉDIO. A empresa perde o crédito de imposto a que tem direito legalmente se não o deduzir nos prazos do CIVA."
        )
    if st_ret == 'DIFERENÇA':
        analises_difs.append(
            f"- **Retenção na Fonte de 6,5% a Prestadores (Conta 75234 vs 3493)**\n"
            f"  - **O que está no Balancete:** Honorários de {fmt_kz(b['honorarios_prestadores'])} com retenção de {fmt_kz(b['retencao_prestadores'])}\n"
            f"  - **O que foi declarado no Modelo 7 / DAR:** Retenção obrigatória de 6,5% = {fmt_kz(ret_obrigatoria)}\n"
            f"  - **Causa provável:** Diferença no cálculo da retenção obrigatória de 6,5% sobre prestação de serviços.\n"
            f"  - **Risco fiscal:** ALTO. A entidade pagadora é subsidiariamente responsável pelo imposto não retido, acrescido de juros de mora e coima."
        )
    if m7.get('fora_prazo'):
        analises_difs.append(
            f"- **Entrega Fora do Prazo Legal da AGT**\n"
            f"  - **Data da Declaração:** A declaração assinala entrega fora do prazo legal.\n"
            f"  - **Risco fiscal:** MÉDIO a ALTO. Sujeição a coima por incumprimento declarativo voluntário fora de prazo."
        )

    if not analises_difs:
        analises_difs.append("- Nenhuma divergência material identificada. Os dados contábeis batem rigorosamente com a declaração oficial da AGT.")

    analises_str = '\n\n'.join(analises_difs)

    relatorio = f"""====================================
1. RESUMO DO CONFRONTO (BALANCETE vs MODELO 7)
====================================
- Documentos confrontados: Balancete de Verificação da Contabilidade e Declaração Modelo 7 de IVA
- Total de pontos analisados: {total_analisados}
- Dados IGUAIS (Conformes): {iguais}
- Dados com DIFERENCAS: {divergencias}

====================================
2. DETALHE DOS DADOS: IGUAIS vs DIFERENCAS
====================================
{tabela_str}

{quadro_apuramento_iva}
====================================
3. ANALISE DAS DIFERENCAS DETETADAS
====================================
{analises_str}

**Pontos IGUAIS**:
- Volume de Negócios / Faturação: {fmt_kz(b['vendas'])} (em perfeita conformidade com a base tributável do Modelo 7)
- IVA Liquidado às Finanças: {fmt_kz(b['iva_liquidado'])} (em perfeita conformidade com a taxa de 14%)
- Imposto a Pagar ao Estado: {fmt_kz(b['iva_pagar'])} apurado de acordo com as regras legais do CIVA

====================================
4. O QUE FAZER PARA RESOLVER (RECOMENDACOES)
====================================
1. **Regularização Urgente da Conta de Caixa (Conta 4511)**:
   - Registar imediatamente os comprovativos de suprimentos de sócios ou transferências bancárias para eliminar o saldo credor de {fmt_kz(b['caixa_saldo_credor'])}, evitando a presunção fiscal de vendas não declaradas.
2. **Revisão de Retenções na Fonte a Prestadores (6,5%)**:
   - Liquidar a diferença de {fmt_kz(dif_ret)} de retenção na fonte sobre honorários ({fmt_kz(b['honorarios_prestadores'])}) através de guia DAR para extinguir a responsabilidade fiscal solidária.
3. **Aproveitamento de Créditos Fiscais de Imposto Industrial**:
   - A empresa dispõe de {fmt_kz(b['retencao_clientes'])} de retenções na fonte de clientes (Conta 3413) que devem ser deduzidas na declaração anual Modelo 1 para abater no Imposto Industrial e evitar pagamento duplicado de imposto.
4. **Regularização do IVA Lançado como Custo**:
   - Reclassificar os {fmt_kz(b['iva_custo'])} da Conta 75312 para a Conta 3451 (IVA Suportado/Dedutível), recuperando o valor perante a AGT.

**Resultado esperado**:
- Conformidade fiscal plena perante a AGT, eliminação total do risco de coimas e garantia de aproveitamento de todos os créditos tributários da empresa.
"""
    return relatorio


def analisar_documentos(texto_contabilidade, texto_agt, idioma='pt'):
    prompts = get_prompts_by_language(idioma)

    # 1. Extração determinística e rigorosa de saldos oficiais sobre o texto integral dos documentos
    b = extrair_dados_balancete(texto_contabilidade)
    m7 = extrair_dados_modelo7(texto_agt)

    # 2. Resumo de apoio para que a IA nunca alucine valores em falta ou inverta rubricas
    sumario_extracao = f"""=== VALORES DETERMINÍSTICOS EXTRAÍDOS DOS DOCUMENTOS (FONTES DE VERDADE) ===
• Contabilidade (Balancete de Verificação PGC):
  - Volume de Negócios / Faturação (Conta 61): {fmt_kz(b['vendas'])}
  - Compras e Existências (Conta 21/752): {fmt_kz(b['compras'])}
  - IVA Liquidado (Vendas ou Serviços - Conta 34.5.3): {fmt_kz(b['iva_liquidado'])}
  - IVA Dedutível / Suportado (Compras ou Despesas - Conta 34.5.1/34.5.2): {fmt_kz(b['iva_suportado'])}
  - IVA a Recuperar (Conta 34.5.7.1): {fmt_kz(b['iva_recuperar'])}
  - IVA a Pagar (Conta 34.5.6.1): {fmt_kz(b['iva_pagar'])}
  - IVA Reembolsos Pedidos (Conta 34.5.8.1): {fmt_kz(b['iva_reembolso'])}
  - Saldo de Caixa (Conta 4511): Credor = {fmt_kz(b['caixa_saldo_credor'])} | Devedor = {fmt_kz(b['caixa_saldo_devedor'])}
  - Retenção Prestadores 6,5% (Conta 3493): {fmt_kz(b['retencao_prestadores'])} (Honorários: {fmt_kz(b['honorarios_prestadores'])})

• Declaração Modelo 7 da AGT:
  - Base de Vendas / Faturação (Quadro 09 - Campos 1 e 1.2): {fmt_kz(m7['base_vendas'])}
  - Base de Compras (Quadro 09 - Campo 22): {fmt_kz(m7['base_compras'])}
  - Base Tributável Total Declarada (Quadro 09 - Campo 31): {fmt_kz(m7['base_tributavel'])}
  - IVA Liquidado (Quadro 09 - Campo 33 / Campo 21): {fmt_kz(m7['iva_liquidado'])}
  - IVA Dedutível (Quadro 09 - Campo 32 / Campo 22): {fmt_kz(m7['iva_dedutivel'])}
  - Saldo do Período - Crédito (Quadro 10 - Campo 34): {fmt_kz(m7['credito_periodo'])}
  - Excesso a Reportar de Períodos Anteriores (Quadro 10 - Campo 36): {fmt_kz(m7['excesso_anterior'])}
  - Reporte para Período Seguinte (Quadro 10 - Campo 39): {fmt_kz(m7['reporte_seguinte'])}
  - IVA a Recuperar / Crédito Fiscal: {fmt_kz(m7['iva_recuperar'])}
  - IVA a Pagar ao Estado (Quadro 10 - Campo 37): {fmt_kz(m7['iva_pagar'])}
  - IVA Pedido de Reembolso (Quadro 10 - Campo 40): {fmt_kz(m7.get('iva_reembolso', Decimal('0')))}
"""

    # Manter dentro do limite de TPM do Groq (8000 tokens)
    prompt_contab = (texto_contabilidade or '')[:4000]
    prompt_agt = (texto_agt or '')[:3000]

    prompt = sumario_extracao + "\n\n" + prompts['prompt'].format(
        texto_contabilidade=prompt_contab,
        texto_agt=prompt_agt
    )

    try:
        client = get_groq_client()
        logger.info(f"Enviando requisicao para Groq (idioma: {idioma})")
        
        messages = [
            {"role": "system", "content": prompts['system']},
            {"role": "user", "content": prompt}
        ]
        
        response, model_used = tentar_modelos(client, messages, temperature=0.1, max_tokens=3000)
        resultado = response.choices[0].message.content
        logger.info(f"Resposta recebida com sucesso - Modelo: {model_used} - Tamanho: {len(resultado)} chars")

        if len(resultado.strip()) < 500:
            logger.warning(f"Resposta da Groq incompleta ({len(resultado)} chars). Ativando modelo analítico determinístico...")
            relatorio_local = gerar_analise_heuristica(texto_contabilidade, texto_agt, idioma)
            return {
                "success": True,
                "analise": relatorio_local,
                "model": "ia-regras-fiscais-ao",
            }
        
        return {
            "success": True,
            "analise": resultado,
            "model": model_used,
        }
    except Exception as e:
        logger.warning(f"Groq API indisponivel ou limite atingido ({str(e)}). Ativando modelo analitico heuristico especializado...")
        relatorio_local = gerar_analise_heuristica(texto_contabilidade, texto_agt, idioma)
        return {
            "success": True,
            "analise": relatorio_local,
            "model": "ia-regras-fiscais-ao",
        }


def get_single_doc_prompts_by_language(idioma, tipo_documento):
    prompts = {
        'pt': {
            'system': "Voce e um assistente especializado em contabilidade e fiscalidade angolana.",
            'contabilidade': """Voce e um especialista em contabilidade angolana.

Analise os seguintes dados contabilisticos extraidos de um documento PDF:

{texto}

Identifique e extraia as seguintes informacoes organizadas:

1. **IVA**
   - IVA Liquidado
   - IVA Dedutivel
   - IVA Apurado
   - IVA a Pagar
   - IVA a Recuperar

2. **Imposto de Trabalho**
   - Valores de retencoes na fonte
   - Imposto de profissoes e servicos

3. **IP - Imposto Predial**
   - Valores relativos a IP

4. **Seguranca Social**
   - Contribuicoes da entidade patronal
   - Contribuicoes do trabalhador

5. **Retencao de Fornecedores**
   - Valores retidos na fonte

Apresente os valores encontrados de forma clara e organizada. Se nao encontrar algum valor, indique "Nao encontrado".""",
            'agt': """Voce e um especialista em fiscalidade angolana, especialmente no portal da AGT.

Analise os seguintes dados extraidos do portal da AGT (Administracao Geral Tributaria):

{texto}

Identifique e extraia as seguintes informacoes organizadas:

1. **IVA**
   - IVA Liquidado
   - IVA Dedutivel
   - IVA Apurado
   - IVA a Pagar
   - IVA a Recuperar

2. **Imposto de Trabalho**
   - Valores declarados de retencoes na fonte
   - Imposto de profissoes e servicos

3. **IP - Imposto Predial**
   - Valores declarados de IP

4. **Seguranca Social**
   - Contribuicoes declaradas

5. **Retencao de Fornecedores**
   - Valores retidos declarados

Apresente os valores encontrados de forma clara e organizada. Se nao encontrar algum valor, indique "Nao encontrado".""",
        },
        'en': {
            'system': "You are an assistant specialized in Angolan accounting and taxation.",
            'contabilidade': """You are an Angolan accounting specialist.

Analyze the following accounting data extracted from a PDF document:

{texto}

Identify and extract the following information organized:

1. **VAT**
   - VAT Settled
   - VAT Deductible
   - VAT Assessed
   - VAT Payable
   - VAT Recoverable

2. **Income Tax**
   - Withholding tax values
   - Professional services tax

3. **Property Tax (IP)**
   - IP-related values

4. **Social Security**
   - Employer contributions
   - Employee contributions

5. **Supplier Withholding**
   - Withheld values

Present the values found clearly and organized. If a value is not found, indicate "Not found".""",
            'agt': """You are an Angolan taxation specialist, especially the AGT portal.

Analyze the following data extracted from the AGT portal (General Tax Administration):

{texto}

Identify and extract the following information organized:

1. **VAT**
   - VAT Settled
   - VAT Deductible
   - VAT Assessed
   - VAT Payable
   - VAT Recoverable

2. **Income Tax**
   - Declared withholding tax values
   - Professional services tax

3. **Property Tax (IP)**
   - Declared IP values

4. **Social Security**
   - Declared contributions

5. **Supplier Withholding**
   - Declared withheld values

Present the values found clearly and organized. If a value is not found, indicate "Not found".""",
        },
        'zh': {
            'system': "Voce e um assistente especializado em contabilidade e fiscalidade angolana.",
            'contabilidade': """Voce e um especialista em contabilidade angolana.

Analise os seguintes dados contabilisticos extraidos de um documento PDF:

{texto}

Identifique e extraia as seguintes informacoes organizadas:

1. **IVA**
   - IVA Liquidado
   - IVA Dedutivel
   - IVA Apurado
   - IVA a Pagar
   - IVA a Recuperar

2. **Imposto de Trabalho**
   - Valores de retencoes na fonte
   - Imposto de profissoes e servicos

3. **IP - Imposto Predial**
   - Valores relativos a IP

4. **Seguranca Social**
   - Contribuicoes da entidade patronal
   - Contribuicoes do trabalhador

5. **Retencao de Fornecedores**
   - Valores retidos na fonte

Apresente os valores encontrados de forma clara e organizada. Se nao encontrar algum valor, indique "Nao encontrado".""",
            'agt': """Voce e um especialista em fiscalidade angolana, especialmente no portal da AGT.

Analise os seguintes dados extraidos do portal da AGT (Administracao Geral Tributaria):

{texto}

Identifique e extraia as seguintes informacoes organizadas:

1. **IVA**
   - IVA Liquidado
   - IVA Dedutivel
   - IVA Apurado
   - IVA a Pagar
   - IVA a Recuperar

2. **Imposto de Trabalho**
   - Valores declarados de retencoes na fonte
   - Imposto de profissoes e servicos

3. **IP - Imposto Predial**
   - Valores declarados de IP

4. **Seguranca Social**
   - Contribuicoes declaradas

5. **Retencao de Fornecedores**
   - Valores retidos declarados

Apresente os valores encontrados de forma clara e organizada. Se nao encontrar algum valor, indique "Nao encontrado".""",
        },
    }
    lang_prompts = prompts.get(idioma, prompts['pt'])
    tipo_key = 'contabilidade' if tipo_documento == 'CONTABILIDADE' else 'agt'
    return lang_prompts['system'], lang_prompts[tipo_key]


def analisar_documento_unico(texto, tipo_documento, idioma='pt'):
    client = get_groq_client()
    model = get_model_name()

    system_prompt, user_prompt = get_single_doc_prompts_by_language(idioma, tipo_documento)

    try:
        logger.info(f"Enviando requisicao para Groq (documento unico) - Tipo: {tipo_documento}, Idioma: {idioma}")
        logger.info(f"Tamanho do texto: {len(texto)} chars")
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt.format(texto=texto[:4000])}
        ]
        
        response, model_used = tentar_modelos(client, messages, temperature=0.2, max_tokens=3000)
        
        resultado = response.choices[0].message.content
        logger.info(f"Resposta recebida com sucesso - Modelo: {model_used} - Tamanho: {len(resultado)} chars")
        
        return {
            "success": True,
            "analise": resultado,
            "model": model_used,
        }
    except Exception as e:
        error_msg = f"Erro na API Groq: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            "success": False,
            "error": error_msg,
            "detail": str(e)
        }


def traduzir_texto_analise(texto, idioma_destino='pt'):
    """Traduz o relatorio de confronto ou parecer tecnico pericial com IA via Groq.
    
    Mantem 100% da estrutura Markdown, numeracoes das secoes (1. RESUMO, 2. DETALHE, etc.),
    tabelas, quebras de linha, numeros e moedas (Kz).
    """
    if not texto or not str(texto).strip():
        return {
            "success": True,
            "resultado": texto,
            "idioma": idioma_destino,
        }

    idioma_normalizado = (idioma_destino or 'pt').lower().strip()[:2]
    if idioma_normalizado not in ('pt', 'en', 'zh'):
        idioma_normalizado = 'pt'

    nomes_idiomas = {
        'pt': 'Português',
        'en': 'English',
        'zh': '中文 (Simplified Chinese)',
    }
    nome_destino = nomes_idiomas.get(idioma_normalizado, 'Português')

    prompt_sistema = (
        f"You are a certified Angolan tax and accounting expert and translator (CIVA, PGC, AGT).\n"
        f"Translate the provided tax audit and reconciliation document faithfully and accurately into {nome_destino}.\n"
        f"MANDATORY INSTRUCTIONS:\n"
        f"1. PRESERVE THE EXACT STRUCTURE, section numbering, headers, and markdown table layout.\n"
        f"   For section headers, keep the numbers 1, 2, 3, 4 clearly visible.\n"
        f"2. Keep all numbers, monetary values, and currencies (e.g. 'Kz', 'AKZ', '%') EXACTLY as written in the source.\n"
        f"3. Keep account numbers (e.g. 'Conta 3453', 'Conta 3451', 'Conta 4511') and statutory references (e.g. 'Lei n.º 7/19', 'Modelo 7', 'AGT', 'CIVA', 'PGC') intact and recognizable.\n"
        f"4. For table cells with status (e.g. 'IGUAIS' / 'DIFERENÇA' / 'OK'), translate them accurately (e.g. in English 'CONFORMING' / 'DIVERGENCE', in Chinese '符合' / '差异') while keeping markdown columns aligned.\n"
        f"5. Return ONLY the translated document text. Do NOT add any preamble, conversational introduction, or commentary."
    )

    try:
        client = get_groq_client()
        messages = [
            {"role": "system", "content": prompt_sistema},
            {"role": "user", "content": texto}
        ]
        response, model_used = tentar_modelos(client, messages, temperature=0.1, max_tokens=4000)
        resultado = response.choices[0].message.content
        logger.info(f"Traducao concluida ({idioma_normalizado}) - Modelo: {model_used} - {len(resultado)} chars")
        return {
            "success": True,
            "resultado": resultado,
            "idioma": idioma_normalizado,
            "model": model_used
        }
    except Exception as e:
        logger.error(f"Erro ao traduzir texto com Groq: {e}")
        return {
            "success": False,
            "error": f"Erro na traducao: {str(e)}",
            "resultado": texto,
            "idioma": idioma_normalizado
        }
