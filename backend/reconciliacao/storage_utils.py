import os
import tempfile
import logging
from contextlib import contextmanager

logger = logging.getLogger('reconciliacao')


@contextmanager
def obter_caminho_local_documento(arquivo_field):
    """
    Gestor de contexto que garante um caminho no sistema de ficheiros local acessível
    para ferramentas como pdfplumber, pypdfium2 e openpyxl.

    - Se o ficheiro estiver no armazenamento local (FileSystemStorage), utiliza
      directamente o `arquivo_field.path`.
    - Se o arquivo contiver um ficheiro temporário local aberto (ex: logo após o upload
      via request.FILES), reutiliza os bytes locais imediatamente sem sobrecarga de rede.
    - Se estiver em armazenamento remoto na nuvem (Cloudinary / S3), descarrega
      o conteúdo para um ficheiro temporário local de forma segura e limpa-o
      automaticamente ao terminar o bloco `with`.
    """
    # 1. Tentar caminho direto no disco local
    try:
        caminho_direto = getattr(arquivo_field, 'path', None)
        if caminho_direto and os.path.exists(caminho_direto):
            yield caminho_direto
            return
    except (NotImplementedError, AttributeError, ValueError, Exception):
        pass

    # 2. Se o arquivo tiver um TemporaryUploadedFile aberto em disco
    underlying = getattr(arquivo_field, 'file', None)
    if underlying:
        temp_local = getattr(underlying, 'temporary_file_path', None)
        if temp_local and callable(temp_local):
            try:
                p = temp_local()
                if p and os.path.exists(p):
                    yield p
                    return
            except Exception:
                pass

    nome = str(getattr(arquivo_field, 'name', '') or 'arquivo.bin')
    ext = os.path.splitext(nome)[1] or '.bin'

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        temp_path = tmp.name
        try:
            # 3. Reutilizar bytes em memória/disco já presentes no objeto antes de tentar rede
            bytes_escritos = False
            if underlying and hasattr(underlying, 'read'):
                try:
                    if hasattr(underlying, 'seek'):
                        underlying.seek(0)
                    if hasattr(underlying, 'chunks'):
                        for chunk in underlying.chunks():
                            tmp.write(chunk)
                    else:
                        dados = underlying.read()
                        if dados:
                            tmp.write(dados)
                    tmp.flush()
                    if hasattr(underlying, 'seek'):
                        underlying.seek(0)
                    if os.path.getsize(temp_path) > 0:
                        bytes_escritos = True
                except Exception as e_mem:
                    logger.debug(f"Não foi possível ler bytes diretos do buffer: {e_mem}")

            # 4. Se não havia bytes em buffer local, descarregar via storage remoto (Cloudinary/S3)
            if not bytes_escritos:
                if hasattr(arquivo_field, 'open'):
                    arquivo_field.open('rb')

                if hasattr(arquivo_field, 'chunks'):
                    for chunk in arquivo_field.chunks():
                        tmp.write(chunk)
                elif hasattr(arquivo_field, 'read'):
                    dados = arquivo_field.read()
                    if dados:
                        tmp.write(dados)
                tmp.flush()
        except Exception as exc:
            logger.warning(f"Erro ao obter ficheiro local para processamento ({nome}): {exc}")
            raise
        finally:
            try:
                if hasattr(arquivo_field, 'close'):
                    arquivo_field.close()
            except Exception:
                pass

    try:
        yield temp_path
    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
