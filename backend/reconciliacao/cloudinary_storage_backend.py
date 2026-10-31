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

    def _get_url(self, name, signed=False):
        name_str = str(name).replace('\\', '/').lstrip('/')
        if name_str.startswith('http://') or name_str.startswith('https://'):
            return name_str
        res_type = self._get_resource_type(name_str)
        try:
            url, _ = cloudinary.utils.cloudinary_url(
                name_str,
                resource_type=res_type,
                secure=True,
                sign_url=signed
            )
            return url
        except Exception:
            cloud_name = getattr(cloudinary.config(), 'cloud_name', '')
            return f"https://res.cloudinary.com/{cloud_name}/{res_type}/upload/{name_str}"

    def url(self, name):
        return self._get_url(name, signed=False)

    def _open(self, name, mode='rb'):
        url = self._get_url(name, signed=True)
        conf = cloudinary.config()
        auth = (conf.api_key, conf.api_secret) if (conf.api_key and conf.api_secret) else None
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(url, auth=auth, headers=headers, timeout=45)
        if response.status_code == 404 or response.status_code == 401:
            alt_type = 'image' if self._get_resource_type(name) == 'raw' else 'raw'
            try:
                alt_url, _ = cloudinary.utils.cloudinary_url(
                    str(name).replace('\\', '/').lstrip('/'),
                    resource_type=alt_type,
                    secure=True,
                    sign_url=True
                )
                alt_resp = requests.get(alt_url, auth=auth, headers=headers, timeout=30)
                if alt_resp.status_code == 200:
                    file = ContentFile(alt_resp.content)
                    file.name = name
                    file.mode = mode
                    return file
            except Exception:
                pass
            raise IOError(f"Ficheiro não acessível no Cloudinary ({response.status_code}): {name} (URL: {url})")
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
