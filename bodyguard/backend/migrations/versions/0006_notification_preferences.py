"""FR-N-03/NFR-08: account-owned preferences; local tests only, no operational execution."""

import sqlalchemy as sa
from alembic import op

revision = "0006_notification_preferences"
down_revision = "0005_account_withdrawal"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_preferences",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("posture_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("posture_minutes", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("sitting_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sitting_minutes", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("sound_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.CheckConstraint(
            "posture_minutes BETWEEN 1 AND 1440", name="notification_posture_minutes"
        ),
        sa.CheckConstraint(
            "sitting_minutes BETWEEN 1 AND 1440", name="notification_sitting_minutes"
        ),
    )


def downgrade() -> None:
    # NFR-08: never discard saved preferences silently while rolling back unrelated account tables.
    if op.get_bind().scalar(sa.text("SELECT EXISTS(SELECT 1 FROM notification_preferences)")):
        raise RuntimeError(
            "Saved notification preferences require an explicit backup and rollback plan"
        )
    op.drop_table("notification_preferences")
