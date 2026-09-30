"""NFR-08: migrations are explicit commands, never automatic at app startup."""

from alembic import context
from sqlalchemy import create_engine

from app.config import Settings
from app.db import metadata

settings = Settings.from_environment()
engine = create_engine(settings.database_url.get_secret_value(), hide_parameters=True)
with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=metadata)
    with context.begin_transaction():
        context.run_migrations()
engine.dispose()
