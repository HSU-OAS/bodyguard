"""FR-R-03/FR-U-04: owned client-reported summaries, no raw body data."""

import sqlalchemy as sa
from alembic import op

revision = "0004_stretch_records"
down_revision = "0003_google_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stretch_records",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("motion_id", sa.String(64), nullable=False),
        sa.Column("protocol_version", sa.String(64), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column("observed_ms", sa.Integer(), nullable=False),
        sa.Column("repetitions", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("ended_at >= started_at", name="record_time_order"),
        sa.CheckConstraint(
            "outcome IN ('completed', 'interrupted', 'skipped')", name="record_outcome"
        ),
        sa.CheckConstraint("observed_ms >= 0 AND observed_ms <= 86400000", name="record_duration"),
        sa.CheckConstraint("repetitions >= 0 AND repetitions <= 10000", name="record_repetitions"),
        sa.CheckConstraint(
            "outcome != 'skipped' OR (observed_ms = 0 AND repetitions = 0)",
            name="record_skipped_empty",
        ),
    )
    op.create_index(
        "ix_stretch_records_owner_time", "stretch_records", ["user_id", "ended_at", "id"]
    )


def downgrade() -> None:
    if op.get_bind().scalar(sa.text("SELECT EXISTS(SELECT 1 FROM stretch_records)")):
        raise RuntimeError("Record data requires an explicit backup and rollback plan")
    op.drop_table("stretch_records")
