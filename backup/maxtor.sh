#!/bin/sh
# Copie nocturne du NAS vers le Maxtor : un dossier par jour, les fichiers
# inchangés sont des liens vers la copie précédente, 30 jours gardés
set -eu
LOG=/volume1/backup/maxtor.log
JOUR=$(date +%F)

# le Maxtor se reconnaît à son fichier .maxtor, quel que soit son nom de montage
DISQUE=
for d in /usb/*; do [ -f "$d/.maxtor" ] && DISQUE=$d; done
[ -n "$DISQUE" ] || { echo "$(date '+%F %T') Maxtor absent, rien copié" >> "$LOG"; exit 1; }

DEST=$DISQUE/DromNAS
mkdir -p "$DEST"
DERNIER=$(ls -1d "$DEST"/20??-??-?? 2>/dev/null | grep -v "/$JOUR$" | tail -1 || true)

rsync -a --delete ${DERNIER:+--link-dest="$DERNIER"} \
  --exclude 'docker/dromnas/pgdata/' --exclude 'docker/dromnas/vaultwarden/' \
  --exclude '@*/' --exclude '.@*/' --exclude '#recycle/' \
  /volume1/photos /volume1/fichiers /volume1/applis /volume1/backup /volume1/docker \
  "$DEST/$JOUR.tmp/"
rm -rf "$DEST/$JOUR" && mv "$DEST/$JOUR.tmp" "$DEST/$JOUR"

ls -1d "$DEST"/20??-??-?? | sort -r | tail -n +31 | xargs -r rm -rf
echo "$(date '+%F %T') ok ($(du -sh "$DEST/$JOUR" | cut -f1))" >> "$LOG"
