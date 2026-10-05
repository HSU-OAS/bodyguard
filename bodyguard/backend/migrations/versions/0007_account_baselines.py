"""FR-M-03: immutable baseline history; owned tests only, operational execution separate."""

import sqlalchemy as sa
from alembic import op

revision = "0007_account_baselines"
down_revision = "0006_notification_preferences"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = [
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("client_version", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
    ]
    checks = [
        sa.CheckConstraint(
            "id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'",
            name="baseline_uuid",
        ),
        sa.CheckConstraint(
            "client_version ~ '^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$'", name="baseline_version"
        ),
    ]
    for metric in ("neck", "shoulder", "trunk"):
        for field, kind in (
            ("method", sa.String(64)),
            ("unit", sa.String(64)),
            ("value", sa.Double()),
        ):
            columns.append(sa.Column(f"{metric}_{field}", kind, nullable=metric != "shoulder"))
        checks.append(
            sa.CheckConstraint(
                f"({metric}_method IS NULL AND {metric}_unit IS NULL "
                f"AND {metric}_value IS NULL) OR "
                f"({metric}_method IS NOT NULL AND {metric}_unit IS NOT NULL "
                f"AND {metric}_value IS NOT NULL)",
                name=f"baseline_{metric}_complete",
            )
        )
        for field in ("method", "unit"):
            checks.append(
                sa.CheckConstraint(
                    f"{metric}_{field} ~ '^[a-zA-Z0-9][a-zA-Z0-9._+-]{{0,63}}$'",
                    name=f"baseline_{metric}_{field}",
                )
            )
        checks.append(
            sa.CheckConstraint(
                f"{metric}_value BETWEEN -9007199254740991 AND 9007199254740991",
                name=f"baseline_{metric}_finite",
            )
        )
    op.create_table("baselines", *columns, *checks)
    op.create_index(
        "ix_baselines_one_active_owner",
        "baselines",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_active"),
    )


def downgrade() -> None:
    # Lock before checking: concurrent commits must not slip between EXISTS and DROP.
    op.get_bind().execute(sa.text("SET LOCAL lock_timeout = '2s'"))
    op.get_bind().execute(sa.text("LOCK TABLE baselines IN ACCESS EXCLUSIVE MODE"))
    if op.get_bind().scalar(sa.text("SELECT EXISTS(SELECT 1 FROM baselines)")):
        raise RuntimeError("Saved baselines require an explicit backup and rollback plan")
    op.drop_table("baselines")
