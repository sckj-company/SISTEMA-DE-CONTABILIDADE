import os
import mimetypes
from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse, FileResponse

from django.views.static import serve

FRONTEND_BUILD_DIR = os.path.abspath(os.path.join(settings.BASE_DIR, '..', 'frontend', 'build'))

def serve_spa(request, path=''):
    if path:
        file_path = os.path.normpath(os.path.join(FRONTEND_BUILD_DIR, path.lstrip('/')))
        if file_path.startswith(FRONTEND_BUILD_DIR) and os.path.isfile(file_path):
            content_type, _ = mimetypes.guess_type(file_path)
            return FileResponse(open(file_path, 'rb'), content_type=content_type)
    index_path = os.path.join(FRONTEND_BUILD_DIR, 'index.html')
    if os.path.exists(index_path):
        return FileResponse(open(index_path, 'rb'), content_type='text/html')
    return HttpResponse("Frontend build não encontrado. Execute 'npm run build' na pasta frontend.", status=404)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('reconciliacao.urls')),
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': os.path.join(FRONTEND_BUILD_DIR, 'static')}),
    re_path(r'^template/(?P<path>.*)$', serve, {'document_root': os.path.join(FRONTEND_BUILD_DIR, 'template')}),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    re_path(r'^(?P<path>.*)$', serve_spa),
]


