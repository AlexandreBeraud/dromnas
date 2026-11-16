#!/bin/sh
# Dump de chaque base du conteneur db, un dossier par nuit, 14 jours gardés
set -eu
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH

DEST=/volume1/backup/dumps
JOUR=$(date +%F)
mkdir -p "$DEST/$JOUR"

docker exec db pg_dumpall -U drom --globals-only > "$DEST/$JOUR/roles.sql"
for base in $(docker exec db psql -U drom -Atc "select datname from pg_database where not datistemplate and datname <> 'postgres'"); do
  docker exec db pg_dump -U drom -Fc "$base" > "$DEST/$JOUR/$base.dump"
done

find "$DEST" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +14 -exec rm -rf {} +
echo "$(date '+%F %T') ok" >> "$DEST/dump.log"
