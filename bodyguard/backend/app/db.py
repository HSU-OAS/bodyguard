"""FR-U-02/03, NFR-08: PostgreSQL constraints and durable security state only."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Double,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
)

metadata = MetaData()
minute_summaries = Table(
    "minute_summaries",
    metadata,
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("minute_start", DateTime(timezone=True), primary_key=True),
    Column("baseline_id", String(36)),
    Column("client_version", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    ForeignKeyConstraint(
        ["user_id", "baseline_id"], ["baselines.user_id", "baselines.id"], ondelete="CASCADE"
    ),
    CheckConstraint(
        "isfinite(minute_start) AND "
        "EXTRACT(SECOND FROM minute_start AT TIME ZONE 'UTC') = 0 AND "
        "EXTRACT(YEAR FROM minute_start AT TIME ZONE 'UTC') BETWEEN 1 AND 9999",
        name="summary_utc_minute",
    ),
    CheckConstraint(
        "client_version ~ '^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$'", name="summary_version"
    ),
)
for _field in (
    "coverage_sec",
    "measured_sec",
    "unmeasurable_sec",
    "present_sec",
    "background_sec",
    "any_bad_sec",
):
    minute_summaries.append_column(Column(_field, Double(), nullable=False))
    minute_summaries.append_constraint(
        CheckConstraint(f"{_field} BETWEEN 0 AND 60", name=f"summary_{_field}")
    )
for _metric in ("neck", "shoulder", "trunk"):
    for _field in ("method", "unit"):
        minute_summaries.append_column(Column(f"{_metric}_{_field}", String(64), nullable=False))
        minute_summaries.append_constraint(
            CheckConstraint(
                f"{_metric}_{_field} ~ '^[a-zA-Z0-9][a-zA-Z0-9._+-]{{0,63}}$'",
                name=f"summary_{_metric}_{_field}",
            )
        )
    minute_summaries.append_column(Column(f"{_metric}_dev_mean", Double()))
    for _field in ("measured_sec", "bad_sec"):
        minute_summaries.append_column(Column(f"{_metric}_{_field}", Double(), nullable=False))
        minute_summaries.append_constraint(
            CheckConstraint(
                f"{_metric}_{_field} BETWEEN 0 AND 60", name=f"summary_{_metric}_{_field}"
            )
        )
    minute_summaries.append_constraint(
        CheckConstraint(
            f"(({_metric}_measured_sec = 0 AND {_metric}_dev_mean IS NULL "
            f"AND {_metric}_bad_sec = 0) OR ({_metric}_measured_sec > 0 "
            f"AND {_metric}_dev_mean IS NOT NULL AND {_metric}_dev_mean "
            "BETWEEN -9007199254740991 AND 9007199254740991)) AND "
            f"{_metric}_bad_sec <= {_metric}_measured_sec + 0.000001 AND "
            f"{_metric}_measured_sec <= measured_sec + 0.000001",
            name=f"summary_{_metric}_consistent",
        )
    )
minute_summaries.append_constraint(
    CheckConstraint(
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
baselines = Table(
    "baselines",
    metadata,
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("id", String(36), primary_key=True),
    Column("client_version", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("is_active", Boolean, nullable=False),
    CheckConstraint(
        "id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'",
        name="baseline_uuid",
    ),
    CheckConstraint(
        "client_version ~ '^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,63}$'", name="baseline_version"
    ),
)
for _metric in ("neck", "shoulder", "trunk"):
    for _field, _type in (("method", String(64)), ("unit", String(64)), ("value", Double())):
        baselines.append_column(
            Column(f"{_metric}_{_field}", _type, nullable=_metric != "shoulder")
        )
    baselines.append_constraint(
        CheckConstraint(
            f"({_metric}_method IS NULL AND {_metric}_unit IS NULL AND {_metric}_value IS NULL) OR "
            f"({_metric}_method IS NOT NULL AND {_metric}_unit IS NOT NULL "
            f"AND {_metric}_value IS NOT NULL)",
            name=f"baseline_{_metric}_complete",
        )
    )
    for _field in ("method", "unit"):
        baselines.append_constraint(
            CheckConstraint(
                f"{_metric}_{_field} ~ '^[a-zA-Z0-9][a-zA-Z0-9._+-]{{0,63}}$'",
                name=f"baseline_{_metric}_{_field}",
            )
        )
    baselines.append_constraint(
        CheckConstraint(
            f"{_metric}_value BETWEEN -9007199254740991 AND 9007199254740991",
            name=f"baseline_{_metric}_finite",
        )
    )
Index(
    "ix_baselines_one_active_owner",
    baselines.c.user_id,
    unique=True,
    postgresql_where=baselines.c.is_active,
)

notification_preferences = Table(
    "notification_preferences",
    metadata,
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("posture_enabled", Boolean, nullable=False, server_default="true"),
    Column("posture_minutes", Integer, nullable=False, server_default="5"),
    Column("sitting_enabled", Boolean, nullable=False, server_default="true"),
    Column("sitting_minutes", Integer, nullable=False, server_default="50"),
    Column("sound_enabled", Boolean, nullable=False, server_default="false"),
    CheckConstraint("posture_minutes BETWEEN 1 AND 1440", name="notification_posture_minutes"),
    CheckConstraint("sitting_minutes BETWEEN 1 AND 1440", name="notification_sitting_minutes"),
)
user_profiles = Table(
    "user_profiles",
    metadata,
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("revision", Integer, nullable=False),
    Column("nickname", String(60)),
    Column("age", Integer),
    Column("height_cm", Double),
    Column("weight_kg", Double),
    Column("gender", String(6)),
    CheckConstraint("revision BETWEEN 1 AND 2147483647", name="profile_revision"),
    CheckConstraint(
        "nickname IS NULL OR length(trim(nickname)) BETWEEN 1 AND 60", name="profile_nickname"
    ),
    CheckConstraint("age IS NULL OR age BETWEEN 0 AND 150", name="profile_age"),
    CheckConstraint(
        "height_cm IS NULL OR (height_cm > 0 AND height_cm <= 1000)", name="profile_height"
    ),
    CheckConstraint(
        "weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 1000)", name="profile_weight"
    ),
    CheckConstraint("gender IS NULL OR gender IN ('male', 'female')", name="profile_gender"),
)
stretch_records = Table(
    "stretch_records",
    metadata,
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("id", String(36), primary_key=True),
    Column("motion_id", String(64), nullable=False),
    Column("protocol_version", String(64), nullable=False),
    Column("started_at", DateTime(timezone=True), nullable=False),
    Column("ended_at", DateTime(timezone=True), nullable=False),
    Column("outcome", String(16), nullable=False),
    Column("observed_ms", Integer, nullable=False),
    Column("repetitions", Integer, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    CheckConstraint("ended_at >= started_at", name="record_time_order"),
    CheckConstraint("outcome IN ('completed', 'interrupted', 'skipped')", name="record_outcome"),
    CheckConstraint("observed_ms >= 0 AND observed_ms <= 86400000", name="record_duration"),
    CheckConstraint("repetitions >= 0 AND repetitions <= 10000", name="record_repetitions"),
    CheckConstraint(
        "outcome != 'skipped' OR (observed_ms = 0 AND repetitions = 0)", name="record_skipped_empty"
    ),
)
Index(
    "ix_stretch_records_owner_time",
    stretch_records.c.user_id,
    stretch_records.c.ended_at,
    stretch_records.c.id,
)
users = Table(
    "users",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("email", String(320), nullable=False, unique=True),
    Column("password_hash", Text),
    Column("google_sub", String(255), unique=True),
    Column("email_verified_at", DateTime(timezone=True), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("credentials_version", Integer, nullable=False, server_default="0"),
    CheckConstraint("credentials_version >= 0", name="user_credentials_version_nonnegative"),
    CheckConstraint(
        "(password_hash IS NOT NULL AND google_sub IS NULL) OR "
        "(password_hash IS NULL AND google_sub IS NOT NULL)",
        name="user_has_authentication",
    ),
)
google_flows = Table(
    "google_flows",
    metadata,
    Column("state_hash", String(64), primary_key=True),
    Column(
        "session_hash",
        String(64),
        ForeignKey("sessions.token_hash", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False, index=True),
    Column("used_at", DateTime(timezone=True)),
)
Index("ix_google_flows_session", google_flows.c.session_hash)
challenges = Table(
    "signup_challenges",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("email", String(320), nullable=False),
    Column("password_hash", Text, nullable=False),
    Column("code_hash", String(64)),
    Column("expires_at", DateTime(timezone=True), nullable=False, index=True),
    Column("attempts", Integer, nullable=False),
    Column("sent_at", DateTime(timezone=True), nullable=False),
    Column("used_at", DateTime(timezone=True)),
    CheckConstraint("attempts >= 0 AND attempts <= 5", name="challenge_attempts_range"),
)
sessions = Table(
    "sessions",
    metadata,
    Column("token_hash", String(64), primary_key=True),
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE")),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("last_seen_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False, index=True),
    Column("revoked_at", DateTime(timezone=True)),
    Column("credentials_version", Integer),
    CheckConstraint(
        "(user_id IS NULL AND credentials_version IS NULL) OR "
        "(user_id IS NOT NULL AND credentials_version IS NOT NULL AND credentials_version >= 0)",
        name="session_credentials_version_matches_user",
    ),
)
Index("ix_sessions_owner", sessions.c.user_id)
resets = Table(
    "password_resets",
    metadata,
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("token_hash", String(64), nullable=False, unique=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False, index=True),
    Column("used_at", DateTime(timezone=True)),
)
limits = Table(
    "auth_limits",
    metadata,
    Column("key_hash", String(64), primary_key=True),
    Column("count", Integer, nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False, index=True),
    CheckConstraint("count >= 0", name="auth_limit_count_nonnegative"),
)
withdrawals = Table(
    "account_withdrawals",
    metadata,
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("challenge_hash", String(64), nullable=False, unique=True),
    Column("session_hash", String(64), nullable=False),
    Column("credentials_version", Integer, nullable=False),
    Column("code_hash", String(64)),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("attempts", Integer, nullable=False),
    CheckConstraint("attempts >= 0 AND attempts <= 5", name="withdrawal_attempts_range"),
    CheckConstraint("credentials_version >= 0", name="withdrawal_credentials_version"),
)
