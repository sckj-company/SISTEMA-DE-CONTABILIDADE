import os
import requests
import cloudinary
import cloudinary.uploader
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
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
    
    Garante links HTTPS permanentes e seguros (secure=True) que persistem
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
        options = {
            'use_filename': True,
            'unique_filename': True,
            'resource_type': res_type,
            'tags': self.TAG,
        }
        folder = os.path.dirname(name).replace('\\', '/')
        if folder:
            options['folder'] = folder
        return cloudinary.uploader.upload(content, **options)

    def _get_url(self, name):
        name_str = str(name).replace('\\', '/')
        if name_str.startswith('http://') or name_str.startswith('https://'):
            return name_str
        name_prefixed = self._prepend_prefix(name_str)
        res_type = self._get_resource_type(name_str)
        cloudinary_resource = cloudinary.CloudinaryResource(
            name_prefixed,
            default_resource_type=res_type
        )
        return cloudinary_resource.build_url(secure=True)

    def url(self, name):
        return self._get_url(name)

    def _open(self, name, mode='rb'):
        url = self._get_url(name)
        response = requests.get(url, timeout=45)
        if response.status_code == 404:
            raise IOError(f"Ficheiro não encontrado no Cloudinary: {name}")
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
