"""FR-U-02/03, NFR-08: PostgreSQL constraints and durable security state only."""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
)

metadata = MetaData()
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
