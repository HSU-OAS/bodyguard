"""FR-U-05: purpose-bound, account-owned withdrawal proof; no operational execution."""

import sqlalchemy as sa
from alembic import op

revision = "0005_account_withdrawal"
down_revision = "0004_stretch_records"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # FR-U-05: account/session cascade lookups must not scan other accounts' whole tables.
    op.create_index("ix_sessions_owner", "sessions", ["user_id"])
    op.create_index("ix_google_flows_session", "google_flows", ["session_hash"])
    op.create_table(
        "account_withdrawals",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("challenge_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("session_hash", sa.String(64), nullable=False),
        sa.Column("credentials_version", sa.Integer(), nullable=False),
        sa.Column("code_hash", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.CheckConstraint("attempts >= 0 AND attempts <= 5", name="withdrawal_attempts_range"),
        sa.CheckConstraint("credentials_version >= 0", name="withdrawal_credentials_version"),
    )


def downgrade() -> None:
    # NFR-08: do not silently discard an outstanding security confirmation.
    if op.get_bind().scalar(sa.text("SELECT EXISTS(SELECT 1 FROM account_withdrawals)")):
        raise RuntimeError("Withdrawal state requires an explicit backup and rollback plan")
    op.drop_table("account_withdrawals")
    op.drop_index("ix_google_flows_session", table_name="google_flows")
    op.drop_index("ix_sessions_owner", table_name="sessions")
