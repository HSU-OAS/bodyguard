# FR-U-04/NFR-08: existing web design and dependencies; no model downloads during release packaging.
FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS build
WORKDIR /opt/bodyguard
RUN npm install --global pnpm@12.6.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY scripts ./scripts
COPY public ./public
RUN pnpm exec tsc --noEmit && pnpm exec vite build && node scripts/export-web-runtime.mjs /opt/web-runtime

FROM nginxinc/nginx-unprivileged:1.30.5-trixie@sha256:d715f7a85cdfea820fec743ea5aee8a22f91e00ff310ad6275d2638112d8cf8d
COPY --from=build /opt/web-runtime /srv/bodyguard
USER 101:101
EXPOSE 8443
# No implicit welcome page or plaintext fallback. Config and TLS must be mounted explicitly.
ENTRYPOINT ["nginx", "-c", "/etc/bodyguard/nginx.conf", "-g", "daemon off;"]
