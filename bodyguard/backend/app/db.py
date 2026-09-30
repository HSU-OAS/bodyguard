"""FR-U-02/03, NFR-08: PostgreSQL constraints and durable security state only."""

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    Text,
)

metadata = MetaData()
users = Table(
    "users",
    metadata,
    Column("id", String(36), primary_key=True),
    Column("email", String(320), nullable=False, unique=True),
    Column("password_hash", Text, nullable=False),
    Column("email_verified_at", DateTime(timezone=True), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
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
)
limits = Table(
    "auth_limits",
    metadata,
    Column("key_hash", String(64), primary_key=True),
    Column("count", Integer, nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False, index=True),
    CheckConstraint("count >= 0", name="auth_limit_count_nonnegative"),
)
