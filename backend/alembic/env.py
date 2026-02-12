import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Ensure project root is on sys.path so 'backend' package is importable
_this_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.dirname(os.path.dirname(_this_dir))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from backend.db import _normalize_database_url

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# read DATABASE_URL from env or default to sqlite
db_url = os.environ.get('DATABASE_URL')
if not db_url:
    os.makedirs('data', exist_ok=True)
    db_url = 'sqlite:///./data/examgen.db'

# Normalize for Neon / Heroku style 'postgres://' URLs
db_url = _normalize_database_url(db_url)

# set sqlalchemy.url programmatically so alembic cli uses env var
config.set_main_option('sqlalchemy.url', db_url)


def run_migrations_offline() -> None:
    url = config.get_main_option('sqlalchemy.url')
    context.configure(url=url, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
