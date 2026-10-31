import os
import requests
import cloudinary
import cloudinary.uploader
import cloudinary.utils
from django.core.files.base import ContentFile
from django.utils.deconstruct import deconstructible
from cloudinary_storage.storage import MediaCloudinaryStorage


@deconstructible
class SmartMediaCloudinaryStorage(MediaCloudinaryStorage):
    """
    Armazenamento inteligente Cloudinary para o Sistema de Contabilidade.
    
    Identifica automaticamente a natureza do ficheiro:
    - Imagens (faturas fotografadas, digitalizações, comprovativos visuais): resource_type='image'
    - Documentos e Ficheiros Contabilísticos (PDFs, Balancetes Excel, CSV, XML): resource_type='raw'
    - Vídeos: resource_type='video'
    
    Garante links HTTPS permanentes e seguros (secure=True) com suporte a
    nomes com acentos, espaços e caracteres especiais, persistindo ficheiros
    mesmo após novos commits, deploys e reinicializações de contentores.
    """
    IMAGE_EXTENSIONS = {
        '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.heic', '.tiff', '.gif', '.svg'
    }
    VIDEO_EXTENSIONS = {
        '.mp4', '.avi', '.mov', '.webm', '.mkv'
    }

    def _get_resource_type(self, name):
        ext = os.path.splitext(str(name).lower())[1]
        if ext in self.IMAGE_EXTENSIONS:
            return 'image'
        elif ext in self.VIDEO_EXTENSIONS:
            return 'video'
        return 'raw'

    def _upload(self, name, content):
        res_type = self._get_resource_type(name)
        clean_name = str(name).replace('\\', '/').lstrip('/')
        options = {
            'public_id': clean_name,
            'overwrite': True,
            'resource_type': res_type,
            'tags': self.TAG,
        }
        return cloudinary.uploader.upload(content, **options)

    def _get_url(self, name):
        name_str = str(name).replace('\\', '/').lstrip('/')
        if name_str.startswith('http://') or name_str.startswith('https://'):
            return name_str
        res_type = self._get_resource_type(name_str)
        try:
            url, _ = cloudinary.utils.cloudinary_url(
                name_str,
                resource_type=res_type,
                secure=True
            )
            return url
        except Exception:
            cloud_name = getattr(cloudinary.config(), 'cloud_name', '')
            return f"https://res.cloudinary.com/{cloud_name}/{res_type}/upload/{name_str}"

    def url(self, name):
        return self._get_url(name)

    def _open(self, name, mode='rb'):
        url = self._get_url(name)
        response = requests.get(url, timeout=45)
        if response.status_code == 404:
            alt_type = 'image' if self._get_resource_type(name) == 'raw' else 'raw'
            try:
                alt_url, _ = cloudinary.utils.cloudinary_url(
                    str(name).replace('\\', '/').lstrip('/'),
                    resource_type=alt_type,
                    secure=True
                )
                alt_resp = requests.get(alt_url, timeout=30)
                if alt_resp.status_code == 200:
                    file = ContentFile(alt_resp.content)
                    file.name = name
                    file.mode = mode
                    return file
            except Exception:
                pass
            raise IOError(f"Ficheiro não encontrado no Cloudinary: {name} (URL: {url})")
        response.raise_for_status()
        file = ContentFile(response.content)
        file.name = name
        file.mode = mode
        return file

    def exists(self, name):
        url = self._get_url(name)
        try:
            response = requests.head(url, timeout=15)
            return response.status_code == 200
        except Exception:
            return False
