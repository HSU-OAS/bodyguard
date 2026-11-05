"""FR-U-04/05: optional account profile; operational application is separately approved."""

import sqlalchemy as sa
from alembic import op

revision = "0009_optional_profile"
down_revision = "0008_minute_summaries"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("nickname", sa.String(60)),
        sa.Column("age", sa.Integer()),
        sa.Column("height_cm", sa.Double()),
        sa.Column("weight_kg", sa.Double()),
        sa.Column("gender", sa.String(6)),
        sa.CheckConstraint("revision BETWEEN 1 AND 2147483647", name="profile_revision"),
        sa.CheckConstraint(
            "nickname IS NULL OR length(trim(nickname)) BETWEEN 1 AND 60", name="profile_nickname"
        ),
        sa.CheckConstraint("age IS NULL OR age BETWEEN 0 AND 150", name="profile_age"),
        sa.CheckConstraint(
            "height_cm IS NULL OR (height_cm > 0 AND height_cm <= 1000)", name="profile_height"
        ),
        sa.CheckConstraint(
            "weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 1000)", name="profile_weight"
        ),
        sa.CheckConstraint("gender IS NULL OR gender IN ('male', 'female')", name="profile_gender"),
    )


def downgrade() -> None:
    # Serialize inserts with the existence check; a concurrent committed profile must survive.
    op.get_bind().execute(sa.text("SET LOCAL lock_timeout = '2s'"))
    op.get_bind().execute(sa.text("LOCK TABLE user_profiles IN ACCESS EXCLUSIVE MODE"))
    # Refuse to erase even empty revision markers without an explicit backup/rollback plan.
    if op.get_bind().scalar(sa.text("SELECT EXISTS(SELECT 1 FROM user_profiles)")):
        raise RuntimeError("Saved profiles require an explicit backup and rollback plan")
    op.drop_table("user_profiles")
