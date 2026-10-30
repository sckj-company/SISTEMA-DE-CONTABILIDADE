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
    - Se estiver em armazenamento remoto na nuvem (Cloudinary / S3), descarrega
      o conteúdo para um ficheiro temporário local de forma segura e limpa-o
      automaticamente ao terminar o bloco `with`.
    """
    caminho_direto = None
    try:
        caminho_direto = arquivo_field.path
        if caminho_direto and os.path.exists(caminho_direto):
            yield caminho_direto
            return
    except (NotImplementedError, AttributeError, ValueError, Exception):
        pass

    nome = str(getattr(arquivo_field, 'name', '') or 'arquivo.bin')
    ext = os.path.splitext(nome)[1] or '.bin'

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        temp_path = tmp.name
        try:
            if hasattr(arquivo_field, 'open'):
                arquivo_field.open('rb')

            if hasattr(arquivo_field, 'chunks'):
                for chunk in arquivo_field.chunks():
                    tmp.write(chunk)
            elif hasattr(arquivo_field, 'read'):
                tmp.write(arquivo_field.read())
            tmp.flush()
        except Exception as exc:
            logger.warning(f"Erro ao transferir ficheiro remoto para temporário ({nome}): {exc}")
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
