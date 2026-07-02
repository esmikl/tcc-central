import os
from pathlib import Path
from urllib.parse import urlparse

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / '.env')

DEBUG = os.environ.get('DEBUG', '').strip().lower() == 'true'

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    if DEBUG:
        # Dev-only fallback so a fresh checkout works without extra setup.
        # Never reused as a real secret — production must set SECRET_KEY.
        SECRET_KEY = 'django-insecure-dev-only-do-not-use-in-production'
    else:
        raise ImproperlyConfigured(
            'SECRET_KEY environment variable must be set when DEBUG is False.'
        )

ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', '').split(',') if h.strip()]
if DEBUG and not ALLOWED_HOSTS:
    ALLOWED_HOSTS = ['*']

# Google Analytics (GA4). Not a secret — it's visible in every page's source —
# so it's fine as a checked-in default, still overridable per-environment.
# Only loaded when DEBUG is False so local/dev traffic doesn't pollute real data.
GA_MEASUREMENT_ID = os.environ.get('GA_MEASUREMENT_ID', 'G-H1QLDP8QRC')

# Cloudflare Turnstile (CAPTCHA on signup). The site key is public (rendered in
# every page's source) so it's fine as a checked-in default. The secret key is
# sensitive — it must come from the environment only, never hardcoded here.
TURNSTILE_SITE_KEY = os.environ.get('TURNSTILE_SITE_KEY', '0x4AAAAAADurJHGA8inVn0eM')
TURNSTILE_SECRET_KEY = os.environ.get('TURNSTILE_SECRET_KEY', '')
if not DEBUG and not TURNSTILE_SECRET_KEY:
    raise ImproperlyConfigured(
        'TURNSTILE_SECRET_KEY environment variable must be set when DEBUG is False.'
    )

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'tcc.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'core.context_processors.analytics',
                'core.context_processors.turnstile',
            ],
        },
    },
]

WSGI_APPLICATION = 'tcc.wsgi.application'

AUTH_USER_MODEL = 'core.User'

DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL:
    _db_url = urlparse(DATABASE_URL)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': _db_url.path.lstrip('/'),
            'USER': _db_url.username,
            'PASSWORD': _db_url.password,
            'HOST': _db_url.hostname,
            'PORT': _db_url.port,
            'OPTIONS': {
                'charset': 'utf8mb4',
            },
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

SESSION_COOKIE_AGE = 2592000  # 30 days
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
