"""FR-U-03/NFR-08: one-use recovery and race-safe credential invalidation."""

import sqlalchemy as sa
from alembic import op

revision = "0002_password_recovery"
down_revision = "0001_accounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("credentials_version", sa.Integer, nullable=False, server_default="0")
    )
    op.create_check_constraint(
        "user_credentials_version_nonnegative", "users", "credentials_version >= 0"
    )
    op.add_column("sessions", sa.Column("credentials_version", sa.Integer))
    op.execute("UPDATE sessions SET credentials_version = 0 WHERE user_id IS NOT NULL")
    op.create_check_constraint(
        "session_credentials_version_matches_user",
        "sessions",
        "(user_id IS NULL AND credentials_version IS NULL) OR "
        "(user_id IS NOT NULL AND credentials_version IS NOT NULL AND credentials_version >= 0)",
    )
    op.create_table(
        "password_resets",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_password_resets_expires_at", "password_resets", ["expires_at"])


def downgrade() -> None:
    # FR-U-03: removing epochs must never revive sessions invalidated by a reset.
    # Any approved rollback signs authenticated users out; it is not a live hot rollback.
    op.execute(
        "UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP "
        "WHERE user_id IS NOT NULL AND revoked_at IS NULL"
    )
    op.drop_table("password_resets")
    op.drop_constraint("session_credentials_version_matches_user", "sessions", type_="check")
    op.drop_column("sessions", "credentials_version")
    op.drop_constraint("user_credentials_version_nonnegative", "users", type_="check")
    op.drop_column("users", "credentials_version")
