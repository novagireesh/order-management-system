#!/bin/sh
# Pull new code (or copy new files here), rebuild and restart without losing data.
set -e
cd "$(dirname "$0")/.."
docker compose build oms
docker compose up -d
docker compose ps
