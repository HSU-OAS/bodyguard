"""FR-U-01/NFR-08: separate Google identity, durable one-use session-bound flows."""

import sqlalchemy as sa
from alembic import op

revision = "0003_google_auth"
down_revision = "0002_password_recovery"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "password_hash", existing_type=sa.Text(), nullable=True)
    op.add_column("users", sa.Column("google_sub", sa.String(255)))
    op.create_unique_constraint("users_google_sub_key", "users", ["google_sub"])
    op.create_check_constraint(
        "user_has_authentication",
        "users",
        "(password_hash IS NOT NULL AND google_sub IS NULL) OR "
        "(password_hash IS NULL AND google_sub IS NOT NULL)",
    )
    op.create_table(
        "google_flows",
        sa.Column("state_hash", sa.String(64), primary_key=True),
        sa.Column(
            "session_hash",
            sa.String(64),
            sa.ForeignKey("sessions.token_hash", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_google_flows_expires_at", "google_flows", ["expires_at"])


def downgrade() -> None:
    # Never delete Google-only users or silently turn them into password accounts.
    if op.get_bind().scalar(
        sa.text("SELECT EXISTS(SELECT 1 FROM users WHERE password_hash IS NULL)")
    ):
        raise RuntimeError("Google-only accounts require an explicit data rollback plan")
    op.drop_table("google_flows")
    op.drop_constraint("user_has_authentication", "users", type_="check")
    op.drop_constraint("users_google_sub_key", "users", type_="unique")
    op.drop_column("users", "google_sub")
    op.alter_column("users", "password_hash", existing_type=sa.Text(), nullable=False)
