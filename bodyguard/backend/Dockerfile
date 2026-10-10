# NFR-08: fixed official bases, lockfile only; no automatic migration or test providers.
FROM ghcr.io/astral-sh/uv:0.11.3@sha256:90bbb3c16635e9627f49eec6539f956d70746c409209041800a0280b93152823 AS uv
FROM python:3.14.7-slim-bookworm@sha256:82bc3c539b8813ada9d68c63b40158fa002f7f33de9bf3312a3dfdc0620dff56 AS build
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /opt/bodyguard
COPY pyproject.toml uv.lock ./
ENV UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy
RUN uv sync --locked --no-dev --no-install-project

FROM python:3.14.7-slim-bookworm@sha256:82bc3c539b8813ada9d68c63b40158fa002f7f33de9bf3312a3dfdc0620dff56
WORKDIR /opt/bodyguard
COPY --from=build /opt/bodyguard/.venv ./.venv
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
USER 10001:10001
# Direct mode never trusts forwarding headers. The explicit local TLS package overrides only this command.
CMD ["/opt/bodyguard/.venv/bin/python", "-m", "uvicorn", "app.main:create_app", "--factory", "--host", "127.0.0.1", "--port", "8000", "--no-proxy-headers", "--no-access-log", "--no-server-header", "--workers", "1"]
