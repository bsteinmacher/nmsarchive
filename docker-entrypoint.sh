#!/bin/sh
set -eu

mkdir -p /app/data/backups /app/data/screenshots

if [ "$(id -u)" = "0" ]; then
  echo "Não grave data/ como root — isso deixa o SQLite só leitura no npm run dev." >&2
  echo "Use: DOCKER_UID=\$(id -u) DOCKER_GID=\$(id -g) docker compose up" >&2
  exit 1
fi

if [ ! -w /app/data ]; then
  echo "data/ não é gravável (uid=$(id -u) gid=$(id -g))." >&2
  echo "No host: chown -R \"\$(id -u):\$(id -g)\" data" >&2
  exit 1
fi

node node_modules/prisma/build/index.js migrate deploy
exec node server.js
