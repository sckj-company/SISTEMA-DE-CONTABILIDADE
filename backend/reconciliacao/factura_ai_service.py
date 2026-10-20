"""Serviço de Inteligência Artificial para Leitura, Extração e Auditoria de Facturas.
Conforme as normas fiscais da República de Angola:
- Código do Imposto sobre o Valor Acrescentado (CIVA - Lei n.º 7/19 e alterações)
- Regime Jurídico das Facturas e Documentos Equivalentes (Decreto Presidencial n.º 292/18)
- Regime de Retenção na Fonte de IVA (Decreto Presidencial n.º 180/19 - 7%)
- Código do Imposto Industrial (Retenção na fonte de 6.5% sobre serviços)
- Plano Geral de Contabilidade de Angola (PGC - Decreto n.º 82/01)
"""
import re
import json
import logging
from decimal import Decimal, InvalidOperation
from datetime import datetime, date

from decouple import config
from groq import Groq
import pdfplumber

from .models import Empresa, Factura, LancamentoContabilistico, LinhaLancamento, DocumentoUpload
from .pdf_service import get_groq_client, tentar_modelos

logger = logging.getLogger('reconciliacao')


def _converter_decimal(valor, padrao='0.00'):
    """Converte com segurança qualquer representação de valor para Decimal."""
    if valor is None or valor == '':
        return Decimal(padrao)
    if isinstance(valor, (int, float, Decimal)):
        try:
            return Decimal(str(valor)).quantize(Decimal('0.01'))
        except (InvalidOperation, TypeError):
            return Decimal(padrao)
    
    val_str = str(valor).strip().replace('Kz', '').replace('KZ', '').replace('kz', '').strip()
    # Tratar pontuação angolana/europeia: 1.500,50 -> 1500.50
    if ',' in val_str and '.' in val_str:
        if val_str.rfind(',') > val_str.rfind('.'):
            val_str = val_str.replace('.', '').replace(',', '.')
        else:
            val_str = val_str.replace(',', '')
    elif ',' in val_str:
        val_str = val_str.replace(',', '.')
    
    # Remover caracteres que não sejam dígitos, sinal ou ponto
    val_limpo = re.sub(r'[^\d.-]', '', val_str)
    try:
        return Decimal(val_limpo).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        return Decimal(padrao)


def _formatar_data(data_str):
    """Normaliza texto de data para YYYY-MM-DD."""
    if not data_str:
        return None
    if isinstance(data_str, (datetime, date)):
        return data_str.strftime('%Y-%m-%d')
    
    data_limpa = str(data_str).strip()
    padroes = [
        (r'(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})', lambda m: f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"),
        (r'(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})', lambda m: f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"),
    ]
    for padrao, formatador in padroes:
        m = re.search(padrao, data_limpa)
        if m:
            try:
                dt_str = formatador(m)
                datetime.strptime(dt_str, '%Y-%m-%d')
                return dt_str
            except ValueError:
                continue
    return None


def extrair_texto_imagem(caminho_imagem):
    """
    Extrai texto legível de fotografias de faturas ou imagens escaneadas usando OCR óptico:
    1. Tesseract OCR (binário nativo com dicionários em português e inglês)
    2. RapidOCR ONNX (se disponível)
    3. Pytesseract
    """
    texto_extraido = []

    # 1. Tentativa prioritária com o binário Tesseract nativo
    import subprocess
    import shutil
    import os

    tess_bins = [
        os.path.expanduser('~/.local/bin/tesseract'),
        shutil.which('tesseract'),
        '/usr/bin/tesseract',
    ]
    tess_bin = next((b for b in tess_bins if b and os.path.exists(b)), None)

    if tess_bin:
        try:
            cmd = [tess_bin, caminho_imagem, 'stdout', '-l', 'por+eng', '--psm', '1']
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if res.returncode == 0 and res.stdout.strip():
                texto_extraido.append(res.stdout.strip())
            else:
                # Tenta modo PSM 3 (auto) se PSM 1 devolver vazio
                cmd[5] = '3'
                res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                if res.returncode == 0 and res.stdout.strip():
                    texto_extraido.append(res.stdout.strip())
        except Exception as err_tess:
            logger.warning(f"Erro ao executar Tesseract OCR nativo: {err_tess}")

    # 2. Se Tesseract não devolveu nada, tentar RapidOCR (motor óptico ONNX)
    if not texto_extraido:
        try:
            from rapidocr_onnxruntime import RapidOCR
            engine = RapidOCR()
            result, _ = engine(caminho_imagem)
            if result:
                for item in result:
                    if item and len(item) > 1 and item[1]:
                        texto_extraido.append(str(item[1]).strip())
        except Exception as e:
            logger.warning(f"RapidOCR indisponível ou falhou: {e}")

    # 3. Se ainda vazio, tentar pytesseract como fallback
    if not texto_extraido:
        try:
            import pytesseract
            from PIL import Image
            img = Image.open(caminho_imagem)
            txt = pytesseract.image_to_string(img, lang='por+eng')
            if txt:
                texto_extraido.append(txt)
        except Exception:
            pass

    return "\n".join(texto_extraido).strip()


def extrair_texto_ficheiro(caminho_arquivo):
    """
    Extrai texto bruto de um PDF (vetorial ou digitalizado), imagem/foto (OCR) ou ficheiro de texto.
    """
    texto = ""
    ext = caminho_arquivo.lower()
    try:
        if ext.endswith('.pdf'):
            with pdfplumber.open(caminho_arquivo) as pdf:
                for pag in pdf.pages:
                    texto_pag = pag.extract_text() or ""
                    texto += texto_pag + "\n"

                # Se o PDF for uma digitalização ou fotografia sem camada de texto (< 50 caracteres)
                if len(texto.strip()) < 50:
                    logger.info("PDF sem camada de texto vetorial. Tentando OCR das páginas escaneadas...")
                    import tempfile
                    for pag in pdf.pages:
                        try:
                            pil_img = pag.to_image(resolution=200).original
                            with tempfile.NamedTemporaryFile(suffix='.png', delete=True) as tmp_img:
                                pil_img.save(tmp_img.name)
                                texto_ocr = extrair_texto_imagem(tmp_img.name)
                                if texto_ocr:
                                    texto += texto_ocr + "\n"
                        except Exception as err_p:
                            logger.warning(f"Erro ao rasterizar página do PDF para OCR: {err_p}")
        elif any(ext.endswith(img_ext) for img_ext in ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.heic', '.tif', '.tiff']):
            texto = extrair_texto_imagem(caminho_arquivo)
        else:
            with open(caminho_arquivo, 'r', encoding='utf-8', errors='ignore') as f:
                texto = f.read()
    except Exception as e:
        logger.error(f"Erro ao ler ficheiro para extracao: {e}")
        texto = ""
    return texto.strip()


PROMPT_SISTEMA_FACTURA = """Tu és um Perito Contabilista e Auditor Fiscal Sénior em Angola, especialista na legislação da AGT (Administração Geral Tributária), Código do IVA (CIVA - Lei n.º 7/19), Decreto Presidencial n.º 292/18 (Regime Jurídico das Facturas e Documentos Equivalentes) e no PGC (Plano Geral de Contabilidade de Angola).

REGRA CARDINAL E ABSOLUTA: EXTRAI LITERALMENTE TUDO O QUE ESTÁ NA FACTURA SEM QUALQUER OMISSÃO!
NÃO RESUMAS, NÃO AGRUPES ARTIGOS E NÃO DESCARTES CAMPOS.
Se a factura tiver 1 linha ou 50 linhas de artigos, extrai TODAS as linhas individualmente com todos os seus atributos (código, descrição, quantidade, unidade, preço unitário, desconto, taxa IVA, motivo de isenção e total).
Extrai igualmente todos os contactos (telefones, emails, moradas, websites), coordenadas bancárias (IBAN, bancos), condições e formas de pagamento, quadro resumo de impostos, menções da AGT, totais ilíquidos e valores por extenso.

Estrutura JSON obrigatória a devolver:
{
  "tipo_documento": "FT" (Factura), "FR" (Factura-Recibo), "FS" (Factura Simplificada), "NC" (Nota de Crédito) ou "ND" (Nota de Débito),
  "tipo_operacao": "COMPRA" (se a empresa é adquirente) ou "VENDA" (se a empresa é emitente),
  "numero_factura": "Número oficial da fatura (ex: FR TB2026/94, FT 2026/00142)",
  "data_emissao": "YYYY-MM-DD",
  "data_vencimento": "YYYY-MM-DD ou null",
  "moeda": "AOA", "Kz", "USD" ou "EUR",
  
  "fornecedor_nome": "Denominação social completa do emissor/fornecedor",
  "fornecedor_nif": "NIF do emissor (10 dígitos)",
  "fornecedor_endereco": "Endereço, rua, edifício, cidade ou província do fornecedor",
  "fornecedor_telefone": "Telefone ou telemóvel do fornecedor (ex: 939772020)",
  "fornecedor_email": "Email de contacto do fornecedor",
  "fornecedor_website": "Website do fornecedor se existir",
  
  "cliente_nome": "Denominação / Nome completo do adquirente/cliente",
  "cliente_nif": "NIF do adquirente (10 dígitos)",
  "cliente_endereco": "Endereço completo do adquirente constante da fatura",
  "cliente_telefone": "Telefone do adquirente se mencionado",
  "cliente_email": "Email do adquirente se mencionado",
  
  "itens": [
    {
      "numero_linha": 1,
      "codigo": "Código do produto ou referência (ex: EAN13, REF-01)",
      "descricao": "Descrição exata e completa do bem ou serviço",
      "quantidade": 1.0,
      "unidade": "Unidade de medida (ex: UNI, KG, MÊS, HORA, CX, L)",
      "preco_unitario": 0.00,
      "desconto": 0.00,
      "desconto_percentual": 0.0,
      "taxa_iva": 14.0,
      "motivo_isencao": "Motivo/código de isenção se taxa for 0% (ex: M02, Isento - Regime Simplificado)",
      "valor_iva": 0.00,
      "total_liquido": 0.00
    }
  ],

  "resumo_impostos": [
    {
      "descricao": "ex: Taxa Geral 14%, Isento, ou Regime Simplificado",
      "taxa": 14.0,
      "incidencia": 0.00,
      "valor_imposto": 0.00,
      "motivo_isencao": "Código ou fundamento legal"
    }
  ],

  "forma_pagamento": "NUMERÁRIO, TRANSFERÊNCIA BANCÁRIA, TPA/MULTICAIXA, A PRAZO, etc.",
  "condicoes_pagamento": "Pronto Pagamento, A 30 dias, etc.",
  "dados_bancarios": [
    {
      "banco": "Nome do Banco (ex: BAI, BFA, BIC, BCI, SOL, etc.)",
      "iban": "IBAN angolano (ex: AO06 0051 0000 ...)",
      "swift": "Código SWIFT se presente",
      "titular": "Titular da conta bancária"
    }
  ],

  "total_iliquido": 0.00 (Soma dos preços unitários x quantidades antes de descontos),
  "total_desconto": 0.00 (Total de descontos comerciais concedidos),
  "base_incidencia": 0.00 (Base tributável sujeita a IVA),
  "taxa_iva": 14.00,
  "valor_iva": 0.00 (Montante total do IVA liquidado),
  "motivo_isencao_iva": "Código/artigo de isenção global se taxa for 0%",
  "retencao_iva": 0.00 (Retenção de 7% de IVA ao abrigo do Dec. Presidencial 180/19),
  "retencao_ii": 0.00 (Retenção na fonte de 6.5% de Imposto Industrial sobre serviços),
  "valor_total": 0.00 (Total bruto da fatura: Base + IVA),
  "valor_liquido": 0.00 (Total líquido a pagar: Total - Retenções),
  "total_extenso": "Total por extenso escrito na fatura (ex: Vinte e três mil quinhentos e trinta e dois kwanzas)",
  
  "software_certificacao": "Menção legal AGT (ex: Processado por Programa Validado nº 385/AGT/2022)",
  "hash_agt": "4 caracteres do hash de certificação digital (ex: mvlZ)",
  "regime_emissor": "Regime Geral, Regime Simplificado ou Regime de Exclusão",
  
  "iva_dedutivel": true ou false,
  "motivo_nao_dedutivel": "Fundamentação se IVA não for dedutível nos termos do Art. 19º e 20º do CIVA",
  
  "conta_custo_sugerida": "Código PGC da despesa (ex: 61.1, 62.2.1, 62.2.4, 62.2.8)",
  "conta_custo_nome": "Designação da conta PGC",
  "conta_terceiro_sugerida": "32.1.1",
  "conta_terceiro_nome": "Fornecedores Nacionais - Correntes",
  "conta_iva_sugerida": "34.5.2",
  "conta_iva_nome": "IVA Suportado - Operações Gerais",
  
  "metadados": {
    "numeracao_interna": "ex: NFR TB2026/94",
    "via": "Original, Duplicado, etc.",
    "software_nome": "ex: Negomil_V_6.4.15 B5",
    "modulo": "ex: COMERCIAL",
    "operador": "ex: admin",
    "data_impressao": "Data/hora de impressão constante do rodapé",
    "troco": 0.00,
    "clausula_agt": "Transcrição do texto de colocação dos bens à disposição"
  },
  "alertas": ["lista de alertas se faltar NIF, certificação AGT, cálculo incorreto, etc."]
}

Devolve APENAS o JSON válido, sem texto explicativo adicional."""


def carregar_json_com_recuperacao(conteudo):
    """
    Carrega JSON de forma resiliente, reparando truncagens ou marcadores markdown.
    """
    if not conteudo:
        return None

    texto = conteudo.strip()
    if "```json" in texto:
        texto = texto.split("```json")[1].split("```")[0].strip()
    elif "```" in texto:
        texto = texto.split("```")[1].split("```")[0].strip()

    # 1. Tentativa padrão
    try:
        return json.loads(texto)
    except Exception:
        pass

    # 2. Reparar JSON truncado
    try:
        # Se cortou no meio de uma string (número ímpar de aspas não escapadas), fecha aspas
        num_aspas = len(re.findall(r'(?<!\\)"', texto))
        if num_aspas % 2 != 0:
            texto += '"'

        # Remove vírgula final solta
        texto = re.sub(r',\s*$', '', texto)

        # Fecha chaves e colchetes em falta
        abertos_chaves = texto.count('{') - texto.count('}')
        abertos_colch = texto.count('[') - texto.count(']')

        texto += ']' * max(0, abertos_colch)
        texto += '}' * max(0, abertos_chaves)

        return json.loads(texto)
    except Exception as e:
        logger.warning(f"Não foi possível reparar JSON da fatura: {e}")
        return None


def analisar_factura_com_ia(texto_factura, empresa_nif=None):
    """Envia o texto da fatura para o Groq LLM e devolve os dados estruturados."""
    client = get_groq_client()
    
    prompt_usuario = f"""Texto integral extraído da Factura:
---
{texto_factura[:12000]}
---
Instrução Mandatória:
1. Extrai SEMPRE com precisão o NIF e Nome do Fornecedor/Emissor (quem emitiu a fatura).
2. Extrai SEMPRE o NIF e Nome do Cliente/Adquirente (a favor de quem foi emitida). Procura por rótulos como 'Contribuinte', 'NIF', 'Exmo.(s)', 'Cliente', 'Adquirente' ou números de 10 dígitos. NUNCA digas que falta NIF do cliente se houver um NIF de adquirente no texto.
3. Extrai rigorosamente TODOS os dados e TODAS as linhas de produtos/serviços sem omitir nada.
4. Gera e devolve EXCLUSIVAMENTE o JSON estruturado."""

    messages = [
        {"role": "system", "content": PROMPT_SISTEMA_FACTURA},
        {"role": "user", "content": prompt_usuario}
    ]

    response, modelo_usado = tentar_modelos(client, messages, temperature=0.1, max_tokens=8000)
    conteudo = response.choices[0].message.content.strip()

    # Carregamento seguro e resiliente de JSON
    dados = carregar_json_com_recuperacao(conteudo)
    if not dados:
        logger.warning(f"Erro ao decodificar JSON do modelo {modelo_usado}. Tentando regex fallback.")
        dados = extrair_dados_heuristica(texto_factura)

    # Enriquecimento complementar inteligente a partir do texto bruto
    # 1. Recuperar NIFs caso algum tenha ficado omisso
    nifs_no_texto = re.findall(r'(?<!\d)(5\d{9})(?!\d)', texto_factura)
    if not dados.get('fornecedor_nif') or len(str(dados.get('fornecedor_nif')).strip()) != 10:
        m_fnif = re.search(r'(?:Contribuinte\s*N\.?[ºo]?|NIF|N\.º\s*de\s*Contribuinte)\s*[:.]?\s*(5\d{9})', texto_factura, re.IGNORECASE)
        if m_fnif:
            dados['fornecedor_nif'] = m_fnif.group(1).strip()
        elif nifs_no_texto:
            c_nif = str(dados.get('cliente_nif') or '')
            for n in nifs_no_texto:
                if n != c_nif:
                    dados['fornecedor_nif'] = n
                    break

    if not dados.get('cliente_nif') or len(str(dados.get('cliente_nif')).strip()) != 10:
        f_nif = str(dados.get('fornecedor_nif') or '')
        for n in nifs_no_texto:
            if n != f_nif:
                dados['cliente_nif'] = n
                break

    # Corrigir cliente_nome se o modelo extraiu uma referência (ex: LDA-76-02-AC)
    cli_str = str(dados.get('cliente_nome') or '').strip()
    if not cli_str or re.match(r'^[A-Z0-9\-_/]+$', cli_str) or 'ref' in cli_str.lower():
        linhas_header = [l.strip() for l in texto_factura.split('\n') if l.strip()][:12]
        for l in linhas_header:
            clean_l = re.sub(r'^\d{4}\s+[A-Za-z]+\s+', '', l).strip()
            if clean_l and clean_l != dados.get('fornecedor_nome') and re.search(r'\b(LDA|LIMITADA|S\.A\.|COMÉRCIO|SERVIÇOS|INDÚSTRIA)\b', clean_l, re.IGNORECASE):
                dados['cliente_nome'] = clean_l
                break

    # 2. Recuperar Contactos (Telefone, Email, Site)
    if not dados.get('fornecedor_telefone'):
        m_tel = re.search(r'(?:Telefone|Telemóvel|Tel|Tel\.)\s*[:.]?\s*([+\d\s\/\-]{8,25})', texto_factura, re.IGNORECASE)
        if m_tel:
            dados['fornecedor_telefone'] = m_tel.group(1).strip().rstrip('/')

    if not dados.get('fornecedor_website'):
        m_site = re.search(r'(www\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', texto_factura, re.IGNORECASE)
        if m_site:
            dados['fornecedor_website'] = m_site.group(1).strip()

    # 3. Recuperar Total por Extenso se presente
    if not dados.get('total_extenso'):
        m_ext = re.search(r'([A-Z][a-zçãéíóú\s]+(?:kwanzas|mil|cento|reais))', texto_factura, re.IGNORECASE)
        if m_ext:
            dados['total_extenso'] = m_ext.group(1).strip()

    # 4. Recuperar Certificação e Hash se omitidos
    if not dados.get('hash_agt'):
        m_hash = re.search(r'([a-zA-Z0-9]{4})-Processado', texto_factura)
        if m_hash:
            dados['hash_agt'] = m_hash.group(1)

    if not dados.get('software_certificacao'):
        m_cert = re.search(r'([A-Za-z0-9\.\-\s]+validado\s*n\.?[ºo]?\s*[0-9A-Za-z\/\_\-]+AGT[0-9A-Za-z\/\_\-]*)', texto_factura, re.IGNORECASE)
        if m_cert:
            dados['software_certificacao'] = m_cert.group(1).strip()

    return dados, modelo_usado


def extrair_dados_heuristica(texto):
    """Extração determinística por Regex para resiliência caso a IA não esteja disponível."""
    dados = {
        "tipo_documento": "FT",
        "tipo_operacao": "COMPRA",
        "numero_factura": "FT",
        "data_emissao": None,
        "data_vencimento": None,
        "moeda": "AOA",
        "fornecedor_nome": "",
        "fornecedor_nif": "",
        "fornecedor_endereco": "",
        "fornecedor_telefone": "",
        "fornecedor_email": "",
        "fornecedor_website": "",
        "cliente_nome": "",
        "cliente_nif": "",
        "cliente_endereco": "",
        "cliente_telefone": "",
        "cliente_email": "",
        "itens": [],
        "resumo_impostos": [],
        "forma_pagamento": "",
        "condicoes_pagamento": "",
        "dados_bancarios": [],
        "total_iliquido": 0.0,
        "total_desconto": 0.0,
        "base_incidencia": 0.0,
        "taxa_iva": 14.0,
        "valor_iva": 0.0,
        "motivo_isencao_iva": "",
        "retencao_iva": 0.0,
        "retencao_ii": 0.0,
        "valor_total": 0.0,
        "valor_liquido": 0.0,
        "total_extenso": "",
        "software_certificacao": "",
        "hash_agt": "",
        "regime_emissor": "",
        "iva_dedutivel": True,
        "motivo_nao_dedutivel": "",
        "conta_custo_sugerida": "62.2",
        "conta_custo_nome": "Fornecimentos e Serviços de Terceiros",
        "conta_terceiro_sugerida": "32.1.1",
        "conta_terceiro_nome": "Fornecedores Nacionais - Correntes",
        "conta_iva_sugerida": "34.5.2",
        "conta_iva_nome": "IVA Suportado - Operações Gerais",
        "metadados": {},
        "alertas": []
    }

    # Tipo e Número de Fatura
    m_num = re.search(r'(F[T|R|S]|NC|ND)\s*([A-Z0-9\/\.\-]+)', texto, re.IGNORECASE)
    if m_num:
        dados["tipo_documento"] = m_num.group(1).upper()
        dados["numero_factura"] = f"{dados['tipo_documento']} {m_num.group(2).strip()}"

    # NIFs de Angola (10 dígitos)
    nifs = re.findall(r'(?<!\d)(5\d{9})(?!\d)', texto)
    if nifs:
        dados["fornecedor_nif"] = nifs[0]
        if len(nifs) > 1:
            dados["cliente_nif"] = nifs[1]

    # Contactos do Fornecedor / Terceiros
    m_tel = re.search(r'(?:Telefone|Telemóvel|Tel|Tel\.)\s*[:.]?\s*([+\d\s\/\-]{8,25})', texto, re.IGNORECASE)
    if m_tel:
        dados["fornecedor_telefone"] = m_tel.group(1).strip()

    m_email = re.search(r'([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', texto)
    if m_email:
        dados["fornecedor_email"] = m_email.group(1).strip()

    m_site = re.search(r'(www\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', texto, re.IGNORECASE)
    if m_site:
        dados["fornecedor_website"] = m_site.group(1).strip()

    # Formas de Pagamento
    m_forma = re.search(r'(NUMER[AÁ]RIO|TRANSFER[EÊ]NCIA|MULTICAIXA|TPA|CHEQUE|A PRAZO)', texto, re.IGNORECASE)
    if m_forma:
        dados["forma_pagamento"] = m_forma.group(1).upper()

    # IBAN angolano (AO06 ...)
    ibans = re.findall(r'(AO06[\s\d]{21,27}|\b00\d{19}\b)', texto, re.IGNORECASE)
    if ibans:
        dados["dados_bancarios"] = [{"banco": "Banco Comercial", "iban": ibans[0].replace(" ", "").strip()}]

    # Regime Fiscal
    m_reg = re.search(r'Regime\s*:\s*([^\n\r]+)', texto, re.IGNORECASE)
    if m_reg:
        dados["regime_emissor"] = m_reg.group(1).strip()

    # Total por Extenso
    m_ext = re.search(r'([A-Z][a-zçãéíóú\s]+(?:kwanzas|mil|cento|reais))', texto, re.IGNORECASE)
    if m_ext:
        dados["total_extenso"] = m_ext.group(1).strip()

    # Certificação AGT
    m_cert = re.search(r'([A-Za-z0-9\.\-\s]+validado\s*n\.?[ºo]?\s*[0-9A-Za-z\/\_\-]+AGT[0-9A-Za-z\/\_\-]*)', texto, re.IGNORECASE)
    if m_cert:
        dados["software_certificacao"] = m_cert.group(1).strip()

    # Hash AGT
    m_hash = re.search(r'([a-zA-Z0-9]{4})-Processado', texto)
    if m_hash:
        dados["hash_agt"] = m_hash.group(1)

    # Tentar extrair nomes de fornecedor e cliente se ausentes
    linhas = [l.strip() for l in texto.split('\n') if l.strip()]
    if not dados.get("fornecedor_nome") and linhas:
        for l in linhas[:6]:
            if not re.search(r'^(factura|recibo|data|original|duplicado|n\.º|nif|contribuinte)', l, re.IGNORECASE) and len(l) > 3:
                dados["fornecedor_nome"] = l
                break

    if not dados.get("cliente_nome"):
        m_cli = re.search(r'(?:Exmo\(s\)|Cliente|Adquirente|Nome|Sr\.?\(a\)?)\s*[:.]?\s*([A-Za-z0-9\s.,&()/-]{4,80})', texto, re.IGNORECASE)
        if m_cli:
            dados["cliente_nome"] = m_cli.group(1).strip()
        else:
            for l in linhas[:12]:
                if l != dados.get("fornecedor_nome") and re.search(r'\b(LDA|LIMITADA|S\.A\.|SERVIÇOS|COMÉRCIO|INDÚSTRIA)\b', l, re.IGNORECASE):
                    dados["cliente_nome"] = l
                    break

    return dados


def auditar_e_validar_regras_fiscais(dados, empresa_atual=None):
    """
    Executa bateria de testes de conformidade fiscal da AGT e PGC de Angola:
    1. Validação de NIFs
    2. Menção legal de certificação de software
    3. Coerência matemática (Base + IVA - Retenções == Líquido)
    4. Dedução de IVA segundo os artigos 19º e 20º do CIVA
    5. Retenção na fonte de IVA (7%) e Imposto Industrial (6.5%)
    """
    alertas = list(dados.get('alertas', []))
    conformidade = 'CONFORME'

    fornecedor_nif = str(dados.get('fornecedor_nif') or '').strip()
    cliente_nif = str(dados.get('cliente_nif') or '').strip()
    certificacao = str(dados.get('software_certificacao') or '').strip()

    # Limpar alertas contraditórios prévios emitidos pela IA
    alertas_limpos = []
    for a in alertas:
        a_str = str(a).strip()
        if cliente_nif and any(t in a_str.lower() for t in ['nif do cliente não consta', 'nif do adquirente não consta', 'falta o nif do cliente', 'sem nif do cliente', 'nif do adquirente ausente']):
            continue
        if fornecedor_nif and any(t in a_str.lower() for t in ['nif do fornecedor não identificado', 'nif do fornecedor ausente', 'falta o nif do fornecedor']):
            continue
        alertas_limpos.append(a_str)
    alertas = alertas_limpos

    # 1. Validação do NIF do Fornecedor
    if not fornecedor_nif:
        alertas.append("NIF do fornecedor não identificado. Documento fiscal incompleto perante a AGT.")
        conformidade = 'IRREGULAR'
    elif len(fornecedor_nif) != 10:
        alertas.append(f"O NIF do fornecedor '{fornecedor_nif}' não possui os 10 dígitos exigidos pela AGT.")
        conformidade = 'AVISO'

    # 2. Verificação do Adquirente com a Empresa Ativa
    if empresa_atual and empresa_atual.nif:
        emp_nif = empresa_atual.nif.strip()
        if cliente_nif and cliente_nif != emp_nif:
            alertas.append(
                f"Informação de Enquadramento: A fatura foi emitida com NIF do adquirente ({cliente_nif}), "
                f"diferente do NIF da empresa ativa ({emp_nif} - {empresa_atual.nome}). "
                "Para deduzir ou escriturar como despesa fiscal, confirme se a empresa titular correta está selecionada."
            )
            dados['iva_dedutivel'] = False
            dados['motivo_nao_dedutivel'] = f"Fatura emitida a favor do NIF ({cliente_nif}), diferente da empresa selecionada ({emp_nif})."
            if conformidade == 'CONFORME':
                conformidade = 'AVISO'

    # 3. Validação de Software Certificado pela AGT (Dec. Presidencial 292/18)
    tem_cert = 'AGT' in certificacao.upper() or 'VALIDADO' in certificacao.upper() or bool(dados.get('hash_agt'))
    if not tem_cert:
        alertas.append(
            "Ausência de menção de software certificado pela AGT ou Hash de validação. "
            "Risco de o documento não ser aceite como custo fiscal."
        )
        if conformidade == 'CONFORME':
            conformidade = 'AVISO'

    # 4. Coerência Matemática
    base = _converter_decimal(dados.get('base_incidencia'))
    taxa = _converter_decimal(dados.get('taxa_iva'), '14.00')
    iva = _converter_decimal(dados.get('valor_iva'))
    ret_iva = _converter_decimal(dados.get('retencao_iva'))
    ret_ii = _converter_decimal(dados.get('retencao_ii'))
    total = _converter_decimal(dados.get('valor_total'))
    liquido = _converter_decimal(dados.get('valor_liquido'))

    # Se total estiver a zero mas base e IVA existirem
    if total == Decimal('0.00') and (base > 0 or iva > 0):
        total = base + iva
        dados['valor_total'] = float(total)

    # Verificar cálculo do IVA esperado
    if taxa > 0 and base > 0:
        iva_esperado = (base * (taxa / Decimal('100.00'))).quantize(Decimal('0.01'))
        if abs(iva - iva_esperado) > Decimal('1.00') and iva > 0:
            alertas.append(
                f"Divergência no cálculo do IVA: IVA faturado ({iva} Kz) difere do cálculo à taxa de {taxa}% ({iva_esperado} Kz)."
            )
            if conformidade == 'CONFORME':
                conformidade = 'AVISO'

    # Verificar valor líquido a pagar
    liquido_calculado = total - ret_iva - ret_ii
    if liquido == Decimal('0.00') and total > 0:
        liquido = liquido_calculado
        dados['valor_liquido'] = float(liquido)
    elif abs(liquido - liquido_calculado) > Decimal('1.00') and liquido > 0:
        alertas.append(
            f"Diferença no valor líquido a pagar: {liquido} Kz faturado vs {liquido_calculado} Kz calculado."
        )

    # 5. Elegibilidade de Dedução do IVA (CIVA Arts. 19º e 20º)
    desc_itens = " ".join([str(it.get('descricao', '')) for it in dados.get('itens', [])]).lower()
    fornecedor_nome = (dados.get('fornecedor_nome') or '').lower()
    
    palavras_restritas = ['combustivel', 'gasolina', 'restaurante', 'refeicao', 'hotel', 'alojamento', 'viatura de turismo', 'tabaco', 'bebidas alcoolicas']
    for p in palavras_restritas:
        if p in desc_itens or p in fornecedor_nome:
            if 'combustivel' in p or 'gasolina' in p:
                alertas.append("CIVA Art. 20.º: O IVA de despesas com combustíveis tem limitações de dedução (exclui gasolina; gasóleo dedutível a 50% salvo atividades de transporte).")
            elif 'restaurante' in p or 'refeicao' in p:
                alertas.append("CIVA Art. 20.º: Despesas com alimentação, refeições e bebidas são excluídas do direito à dedução do IVA.")
                dados['iva_dedutivel'] = False
                dados['motivo_nao_dedutivel'] = "Excluído de dedução nos termos da alínea d) do n.º 1 do Art. 20.º do CIVA."
            elif 'viatura' in p:
                alertas.append("CIVA Art. 20.º: Despesas com viaturas de turismo não afectas à exploração comercial são excluídas da dedução.")
            break

    dados['conformidade_agt'] = conformidade
    dados['alertas_auditoria'] = alertas
    return dados


def processar_factura_ficheiro(arquivo_path, nome_arquivo, empresa_id=None, doc_upload_id=None, user=None):
    """
    Pipeline mestre:
    1. Extrai texto do ficheiro.
    2. Envia para IA analisar com as regras de Angola.
    3. Executa auditoria fiscal automatizada.
    4. Grava na tabela Factura associada à empresa com TODOS os dados detalhados e o utilizador que a digitalizou.
    """
    texto = extrair_texto_ficheiro(arquivo_path)
    if not texto:
        raise ValueError("Não foi possível extrair texto do documento da fatura.")

    empresa = None
    if empresa_id:
        empresa = Empresa.objects.filter(pk=empresa_id).first()

    empresa_nif = empresa.nif if empresa else None
    dados_ia, modelo = analisar_factura_com_ia(texto, empresa_nif=empresa_nif)
    dados_validados = auditar_e_validar_regras_fiscais(dados_ia, empresa_atual=empresa)

    # Identificar Empresa se não foi passada
    if not empresa:
        c_nif = dados_validados.get('cliente_nif')
        if c_nif:
            empresa = Empresa.objects.filter(nif=c_nif).first()
        if not empresa:
            f_nif = dados_validados.get('fornecedor_nif')
            if f_nif:
                empresa = Empresa.objects.filter(nif=f_nif).first()
        if not empresa:
            empresa = Empresa.objects.first()

    if not empresa:
        raise ValueError("Nenhuma empresa configurada no sistema para associar a fatura.")

    # Data de emissão e período
    dt_emissao = _formatar_data(dados_validados.get('data_emissao'))
    dt_venc = _formatar_data(dados_validados.get('data_vencimento'))
    
    ano = None
    mes = None
    if dt_emissao:
        partes = dt_emissao.split('-')
        ano = int(partes[0])
        mes = int(partes[1])
    else:
        ano = datetime.now().year
        mes = datetime.now().month

    doc_upload = None
    if doc_upload_id:
        doc_upload = DocumentoUpload.objects.filter(pk=doc_upload_id).first()

    factura = Factura.objects.create(
        empresa=empresa,
        documento=doc_upload,
        tipo_documento=(dados_validados.get('tipo_documento') or 'FT')[:10],
        tipo_operacao=(dados_validados.get('tipo_operacao') or 'COMPRA')[:10],
        numero_factura=(dados_validados.get('numero_factura') or f"FT-{int(datetime.now().timestamp())}")[:80],
        data_emissao=dt_emissao,
        data_vencimento=dt_venc,
        ano=ano,
        mes=mes,
        fornecedor_nome=(dados_validados.get('fornecedor_nome') or '')[:200],
        fornecedor_nif=(dados_validados.get('fornecedor_nif') or '')[:30],
        fornecedor_endereco=(dados_validados.get('fornecedor_endereco') or '')[:255],
        fornecedor_telefone=(dados_validados.get('fornecedor_telefone') or '')[:100],
        fornecedor_email=(dados_validados.get('fornecedor_email') or '')[:150],
        fornecedor_website=(dados_validados.get('fornecedor_website') or '')[:150],
        cliente_nome=(dados_validados.get('cliente_nome') or '')[:200],
        cliente_nif=(dados_validados.get('cliente_nif') or '')[:30],
        cliente_endereco=(dados_validados.get('cliente_endereco') or '')[:255],
        cliente_telefone=(dados_validados.get('cliente_telefone') or '')[:100],
        cliente_email=(dados_validados.get('cliente_email') or '')[:150],
        moeda=(dados_validados.get('moeda') or 'AOA')[:10],
        total_iliquido=_converter_decimal(dados_validados.get('total_iliquido')),
        total_desconto=_converter_decimal(dados_validados.get('total_desconto')),
        total_extenso=(dados_validados.get('total_extenso') or '')[:255],
        forma_pagamento=(dados_validados.get('forma_pagamento') or '')[:100],
        condicoes_pagamento=(dados_validados.get('condicoes_pagamento') or '')[:150],
        dados_bancarios=dados_validados.get('dados_bancarios') or [],
        resumo_impostos=dados_validados.get('resumo_impostos') or [],
        regime_emissor=(dados_validados.get('regime_emissor') or '')[:100],
        base_incidencia=_converter_decimal(dados_validados.get('base_incidencia')),
        taxa_iva=_converter_decimal(dados_validados.get('taxa_iva'), '14.00'),
        valor_iva=_converter_decimal(dados_validados.get('valor_iva')),
        motivo_isencao_iva=(dados_validados.get('motivo_isencao_iva') or '')[:200],
        retencao_iva=_converter_decimal(dados_validados.get('retencao_iva')),
        retencao_ii=_converter_decimal(dados_validados.get('retencao_ii')),
        valor_total=_converter_decimal(dados_validados.get('valor_total')),
        valor_liquido=_converter_decimal(dados_validados.get('valor_liquido')),
        software_certificacao=(dados_validados.get('software_certificacao') or '')[:150],
        hash_agt=(dados_validados.get('hash_agt') or '')[:20],
        iva_dedutivel=bool(dados_validados.get('iva_dedutivel', True)),
        motivo_nao_dedutivel=(dados_validados.get('motivo_nao_dedutivel') or '')[:255],
        conformidade_agt=(dados_validados.get('conformidade_agt') or 'CONFORME')[:20],
        alertas_auditoria=dados_validados.get('alertas_auditoria') or [],
        metadados=dados_validados.get('metadados') or {},
        conta_custo_sugerida=(dados_validados.get('conta_custo_sugerida') or '62.2')[:40],
        conta_custo_nome=(dados_validados.get('conta_custo_nome') or 'Fornecimentos e Serviços de Terceiros')[:150],
        conta_terceiro_sugerida=(dados_validados.get('conta_terceiro_sugerida') or '32.1.1')[:40],
        conta_terceiro_nome=(dados_validados.get('conta_terceiro_nome') or 'Fornecedores Nacionais - Correntes')[:150],
        conta_iva_sugerida=(dados_validados.get('conta_iva_sugerida') or '34.5.2')[:40],
        conta_iva_nome=(dados_validados.get('conta_iva_nome') or 'IVA Suportado - Operações Gerais')[:150],
        itens_detalhe=dados_validados.get('itens') or [],
        criado_por=user
    )

    return factura


def criar_lancamento_contabilistico_da_factura(factura, user=None):
    """
    Gera lançamento no Livro Diário em Partidas Dobradas:
    Débito: Conta de Custo (Base tributável + IVA se não dedutível)
    Débito: Conta de IVA Suportado 34.5.2 (se IVA for dedutível)
    Crédito: Retenções na Fonte 34.2.x (se houver)
    Crédito: Conta de Fornecedor 32.1.x (Valor líquido a pagar)
    """
    if factura.lancado_na_contabilidade and factura.lancamento:
        return factura.lancamento, False, "Esta fatura já se encontra lançada na contabilidade."

    empresa = factura.empresa
    ano = factura.ano or datetime.now().year
    mes = factura.mes or datetime.now().month
    dt_lanc = factura.data_emissao or date.today()

    # Gerar número sequencial do diário de compras
    total_compras = LancamentoContabilistico.objects.filter(
        empresa=empresa, ano=ano, tipo_diario='COMPRAS'
    ).count() + 1
    numero_diario = f"COM-{ano}-{total_compras:04d}"

    descricao = f"Registo de Fatura {factura.numero_factura} - {factura.fornecedor_nome or 'Fornecedor'}"
    if len(descricao) > 250:
        descricao = descricao[:250]

    # Cálculos das parcelas em partidas dobradas
    base = factura.base_incidencia
    iva = factura.valor_iva
    ret_iva = factura.retencao_iva
    ret_ii = factura.retencao_ii
    liquido = factura.valor_liquido
    total_bruto = factura.valor_total

    # Se IVA não for dedutível, vai para o custo do bem/serviço (regra fundamental PGC)
    if factura.iva_dedutivel:
        valor_custo = base
        valor_iva_dedutivel = iva
    else:
        valor_custo = base + iva
        valor_iva_dedutivel = Decimal('0.00')

    # Total Débito = valor_custo + valor_iva_dedutivel == total_bruto
    # Total Crédito = ret_iva + ret_ii + liquido == total_bruto
    total_debito = (valor_custo + valor_iva_dedutivel).quantize(Decimal('0.01'))
    total_credito = (liquido + ret_iva + ret_ii).quantize(Decimal('0.01'))

    # Ajuste fino de cêntimos de arredondamento se necessário
    if total_debito != total_credito:
        diff = total_debito - total_credito
        liquido += diff
        total_credito = total_debito

    lancamento = LancamentoContabilistico.objects.create(
        empresa=empresa,
        numero_diario=numero_diario,
        data_lancamento=dt_lanc,
        tipo_diario='COMPRAS',
        descricao=descricao,
        documento_referencia=factura.numero_factura,
        documento_anexo=factura.documento,
        ano=ano,
        mes=mes,
        total_debito=total_debito,
        total_credito=total_credito,
        estado='CONFIRMADO',
        criado_por=user
    )

    ordem = 1
    # 1. Linha Débito Custo
    LinhaLancamento.objects.create(
        lancamento=lancamento,
        ordem=ordem,
        conta_codigo=factura.conta_custo_sugerida or '62.2',
        conta_nome=factura.conta_custo_nome or 'Fornecimentos e Serviços de Terceiros',
        debito=valor_custo,
        credito=Decimal('0.00'),
        descricao_linha=f"Custo base fatura {factura.numero_factura}",
        terceiro_nif=factura.fornecedor_nif,
        terceiro_nome=factura.fornecedor_nome
    )
    ordem += 1

    # 2. Linha Débito IVA Suportado (se dedutível)
    if valor_iva_dedutivel > Decimal('0.00'):
        LinhaLancamento.objects.create(
            lancamento=lancamento,
            ordem=ordem,
            conta_codigo=factura.conta_iva_sugerida or '34.5.2',
            conta_nome=factura.conta_iva_nome or 'IVA Suportado - Operações Gerais',
            debito=valor_iva_dedutivel,
            credito=Decimal('0.00'),
            descricao_linha=f"IVA Suportado {factura.taxa_iva}% - {factura.numero_factura}",
            terceiro_nif=factura.fornecedor_nif,
            terceiro_nome=factura.fornecedor_nome
        )
        ordem += 1

    # 3. Linha Crédito Retenção de IVA (se houver)
    if ret_iva > Decimal('0.00'):
        LinhaLancamento.objects.create(
            lancamento=lancamento,
            ordem=ordem,
            conta_codigo='34.2.2',
            conta_nome='Retenção na Fonte de IVA (7%)',
            debito=Decimal('0.00'),
            credito=ret_iva,
            descricao_linha=f"Retenção 7% IVA Dec. 180/19 s/ {factura.numero_factura}",
            terceiro_nif=factura.fornecedor_nif,
            terceiro_nome=factura.fornecedor_nome
        )
        ordem += 1

    # 4. Linha Crédito Retenção de Imposto Industrial (se houver)
    if ret_ii > Decimal('0.00'):
        LinhaLancamento.objects.create(
            lancamento=lancamento,
            ordem=ordem,
            conta_codigo='34.2.1',
            conta_nome='Retenção na Fonte de Imposto Industrial (6.5%)',
            debito=Decimal('0.00'),
            credito=ret_ii,
            descricao_linha=f"Retenção 6.5% Imposto Industrial s/ {factura.numero_factura}",
            terceiro_nif=factura.fornecedor_nif,
            terceiro_nome=factura.fornecedor_nome
        )
        ordem += 1

    # 5. Linha Crédito Fornecedor (Valor líquido a liquidar)
    LinhaLancamento.objects.create(
        lancamento=lancamento,
        ordem=ordem,
        conta_codigo=factura.conta_terceiro_sugerida or '32.1.1',
        conta_nome=factura.conta_terceiro_nome or 'Fornecedores Nacionais - Correntes',
        debito=Decimal('0.00'),
        credito=liquido,
        descricao_linha=f"Valor líquido da fatura {factura.numero_factura}",
        terceiro_nif=factura.fornecedor_nif,
        terceiro_nome=factura.fornecedor_nome
    )

    factura.lancado_na_contabilidade = True
    factura.lancamento = lancamento
    factura.save(update_fields=['lancado_na_contabilidade', 'lancamento', 'updated_at'])

    return lancamento, True, f"Lançamento {numero_diario} escriturado com sucesso no Diário de Compras."
