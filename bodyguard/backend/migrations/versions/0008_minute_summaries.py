"""FR-R-01/04: immutable owned minute aggregates; operational execution separate."""

import sqlalchemy as sa
from alembic import op

revision = "0008_minute_summaries"
down_revision = "0007_account_baselines"
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
        sa.Column("minute_start", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("baseline_id", sa.String(36)),
        sa.Column("client_version", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    ]
    checks = [
        sa.ForeignKeyConstraint(
            ["user_id", "baseline_id"], ["baselines.user_id", "baselines.id"], ondelete="CASCADE"
        ),
        sa.CheckConstraint(
            "isfinite(minute_start) AND "
            "EXTRACT(SECOND FROM minute_start AT TIME ZONE 'UTC') = 0 AND "
            "EXTRACT(YEAR FROM minute_start AT TIME ZONE 'UTC') BETWEEN 1 AND 9999",
            name="summary_utc_minute",
        ),
        sa.CheckConstraint(
            "client_version ~ '^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$'", name="summary_version"
        ),
    ]
    for field in (
        "coverage_sec",
        "measured_sec",
        "unmeasurable_sec",
        "present_sec",
        "background_sec",
        "any_bad_sec",
    ):
        columns.append(sa.Column(field, sa.Double(), nullable=False))
        checks.append(sa.CheckConstraint(f"{field} BETWEEN 0 AND 60", name=f"summary_{field}"))
    for metric in ("neck", "shoulder", "trunk"):
        for field in ("method", "unit"):
            columns.append(sa.Column(f"{metric}_{field}", sa.String(64), nullable=False))
            checks.append(
                sa.CheckConstraint(
                    f"{metric}_{field} ~ '^[a-zA-Z0-9][a-zA-Z0-9._+-]{{0,63}}$'",
                    name=f"summary_{metric}_{field}",
                )
            )
        columns.append(sa.Column(f"{metric}_dev_mean", sa.Double()))
        for field in ("measured_sec", "bad_sec"):
            columns.append(sa.Column(f"{metric}_{field}", sa.Double(), nullable=False))
            checks.append(
                sa.CheckConstraint(
                    f"{metric}_{field} BETWEEN 0 AND 60", name=f"summary_{metric}_{field}"
                )
            )
        checks.append(
            sa.CheckConstraint(
                f"(({metric}_measured_sec = 0 AND {metric}_dev_mean IS NULL "
                f"AND {metric}_bad_sec = 0) OR ({metric}_measured_sec > 0 "
                f"AND {metric}_dev_mean IS NOT NULL AND {metric}_dev_mean "
                "BETWEEN -9007199254740991 AND 9007199254740991)) AND "
                f"{metric}_bad_sec <= {metric}_measured_sec + 0.000001 AND "
                f"{metric}_measured_sec <= measured_sec + 0.000001",
                name=f"summary_{metric}_consistent",
            )
        )
    checks.append(
        sa.CheckConstraint(
            "ABS(coverage_sec - measured_sec - unmeasurable_sec - background_sec) <= 0.000001 AND "
            "measured_sec <= present_sec + 0.000001 AND "
            "present_sec <= coverage_sec - background_sec + 0.000001 AND "
            "measured_sec <= neck_measured_sec + shoulder_measured_sec "
            "+ trunk_measured_sec + 0.000001 AND "
            "GREATEST(neck_bad_sec, shoulder_bad_sec, trunk_bad_sec) <= any_bad_sec + 0.000001 AND "
            "any_bad_sec <= measured_sec + 0.000001 AND "
            "any_bad_sec <= neck_bad_sec + shoulder_bad_sec + trunk_bad_sec + 0.000001 AND "
            "measured_sec - any_bad_sec <= neck_measured_sec - neck_bad_sec "
            "+ shoulder_measured_sec - shoulder_bad_sec + trunk_measured_sec - trunk_bad_sec "
            "+ 0.000001 AND "
            "(baseline_id IS NOT NULL OR (neck_measured_sec = 0 AND trunk_measured_sec = 0))",
            name="summary_consistent",
        )
    )
    op.create_table("minute_summaries", *columns, *checks)


def downgrade() -> None:
    op.get_bind().execute(sa.text("SET LOCAL lock_timeout = '2s'"))
    op.get_bind().execute(sa.text("LOCK TABLE minute_summaries IN ACCESS EXCLUSIVE MODE"))
    if op.get_bind().scalar(sa.text("SELECT EXISTS(SELECT 1 FROM minute_summaries)")):
        raise RuntimeError("Saved minute summaries require an explicit backup and rollback plan")
    op.drop_table("minute_summaries")
