"""FR-N-03/FR-U-04/05: account-owned timer preferences, no classifier or notification effects."""

from collections.abc import Callable

from fastapi import FastAPI, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import Connection, Engine, select
from sqlalchemy.dialects.postgresql import insert

from app.db import notification_preferences


class NotificationPreferences(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    posture_enabled: bool
    posture_minutes: int = Field(ge=1, le=1440)
    sitting_enabled: bool
    sitting_minutes: int = Field(ge=1, le=1440)
    sound_enabled: bool


def register_notification_preferences(
    app: FastAPI,
    db: Engine,
    owner: Callable[[Connection, Request, bool], str],
) -> None:
    fields = [notification_preferences.c[name] for name in NotificationPreferences.model_fields]

    @app.get("/api/v1/settings/notifications", response_model=NotificationPreferences)
    def read_notifications(request: Request) -> NotificationPreferences:
        with db.begin() as connection:
            user_id = owner(connection, request, False)
            row = (
                connection.execute(
                    select(*fields).where(notification_preferences.c.user_id == user_id)
                )
                .mappings()
                .first()
            )
            if row is not None:
                return NotificationPreferences.model_validate(dict(row))
            # Reading defaults creates no preference row; browser permission/sound stay untouched.
            return NotificationPreferences(
                posture_enabled=True,
                posture_minutes=5,
                sitting_enabled=True,
                sitting_minutes=50,
                sound_enabled=False,
            )

    @app.post("/api/v1/settings/notifications", response_model=NotificationPreferences)
    def save_notifications(
        payload: NotificationPreferences,
        request: Request,
    ) -> NotificationPreferences:
        with db.begin() as connection:
            user_id = owner(connection, request, True)
            values = payload.model_dump()
            row = (
                connection.execute(
                    insert(notification_preferences)
                    .values(user_id=user_id, **values)
                    .on_conflict_do_update(
                        index_elements=[notification_preferences.c.user_id], set_=values
                    )
                    .returning(*fields)
                )
                .mappings()
                .one()
            )
            return NotificationPreferences.model_validate(dict(row))
