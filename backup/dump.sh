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

# coffre Vaultwarden : arrêté deux secondes pour une copie cohérente,
# relancé même si l'archive rate
docker stop vault >/dev/null
coffre=ok
tar czf "$DEST/$JOUR/vaultwarden.tar.gz" -C /dromnas vaultwarden || coffre=rate
docker start vault >/dev/null

find "$DEST" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +14 -exec rm -rf {} +

# sans « ok », le Hub passe la sauvegarde en rouge au bout de 26 h
if [ "$coffre" != ok ]; then
  echo "$(date '+%F %T') erreur : archive Vaultwarden" >> "$DEST/dump.log"
  exit 1
fi
echo "$(date '+%F %T') ok" >> "$DEST/dump.log"
