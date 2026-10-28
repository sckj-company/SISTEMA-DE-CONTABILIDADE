from django.db import migrations
from django.contrib.auth.hashers import make_password


def seed_users(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    Group = apps.get_model('auth', 'Group')
    Empresa = apps.get_model('reconciliacao', 'Empresa')
    EmpresaUtilizador = apps.get_model('reconciliacao', 'EmpresaUtilizador')

    # 1. Empresa Principal SCKJ
    empresa, _ = Empresa.objects.get_or_create(
        nif='5002830280',
        defaults={
            'nome': 'SCKJ - COMÉRCIO E SERVIÇOS, (SU), LDA',
            'regime_iva': 'Geral',
            'email': 'suporte@sckj.co.ao',
            'provincia': 'Luanda',
        }
    )

    # 2. Grupo Operador de Facturação
    grupo_op, _ = Group.objects.get_or_create(name='Operador de Facturação')

    # 3. User Admin Master (Acesso Global)
    admin_user, _ = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@sckj.co.ao',
            'first_name': 'Administrador',
            'last_name': 'SCKJ',
            'is_staff': True,
            'is_superuser': True,
            'is_active': True,
        }
    )
    admin_user.password = make_password('Admin@2026')
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.is_active = True
    admin_user.save()

    EmpresaUtilizador.objects.update_or_create(
        empresa=empresa,
        utilizador=admin_user,
        defaults={'perfil_acesso': 'ADMIN', 'ativo': True}
    )

    # 4. User Operador de Facturação (Acesso ao Portal de Facturas)
    operador_user, _ = User.objects.get_or_create(
        username='operador',
        defaults={
            'email': 'operador@sckj.co.ao',
            'first_name': 'Operador',
            'last_name': 'Facturação',
            'is_staff': False,
            'is_superuser': False,
            'is_active': True,
        }
    )
    operador_user.password = make_password('Operador@2026')
    operador_user.is_active = True
    operador_user.save()
    operador_user.groups.add(grupo_op)

    EmpresaUtilizador.objects.update_or_create(
        empresa=empresa,
        utilizador=operador_user,
        defaults={'perfil_acesso': 'OPERADOR_FACTURAS', 'ativo': True}
    )

    # 5. User Contabilista (Acesso ao Confronto e Arquivo)
    contab_user, _ = User.objects.get_or_create(
        username='contabilista',
        defaults={
            'email': 'contabilista@sckj.co.ao',
            'first_name': 'Contabilista',
            'last_name': 'Fiscal',
            'is_staff': False,
            'is_superuser': False,
            'is_active': True,
        }
    )
    contab_user.password = make_password('Contabilista@2026')
    contab_user.is_active = True
    contab_user.save()

    EmpresaUtilizador.objects.update_or_create(
        empresa=empresa,
        utilizador=contab_user,
        defaults={'perfil_acesso': 'CONTABILISTA', 'ativo': True}
    )


def rollback_users(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('reconciliacao', '0016_factura_criado_por_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_users, rollback_users),
    ]
