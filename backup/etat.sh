#!/bin/sh
# État du NAS pour le Hub : relevé écrit toutes les 15 minutes par le conteneur cron
# dans /volume1/backup/etat/etat.json, que Caddy sert sur hub.dromnas.win/etat.json
set -u
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
B=/volume1/backup
DEST=$B/etat
mkdir -p "$DEST"

# texte JSON (guillemets et antislashs échappés)
j() { printf '"%s"' "$(printf '%s' "$1" | tr -d '\r\n\t' | sed 's/\\/\\\\/g; s/"/\\"/g')"; }
# "AAAA-MM-JJ HH:MM:SS" en secondes depuis 1970, null si absent
sec() { [ -n "$1" ] && date -d "$1" +%s 2>/dev/null || echo null; }
# date en tête de la dernière ligne qui correspond, dans un journal
derniere() { grep -a "$2" "$1" 2>/dev/null | tail -1 | cut -c1-19; }

# processeur : deux lectures de /proc/stat à une seconde d'écart
lire_cpu() { awk '/^cpu /{ print $2+$3+$4+$5+$6+$7+$8, $5+$6 }' /proc/stat; }
set -- $(lire_cpu); t1=$1; i1=$2
sleep 1
set -- $(lire_cpu); t2=$1; i2=$2
cpu=0; [ "$t2" -gt "$t1" ] && cpu=$(( 100 * ((t2 - t1) - (i2 - i1)) / (t2 - t1) ))

mem=$(awk '/^MemTotal/{t=$2} /^MemAvailable/{d=$2} END{ printf "{\"total\":%d,\"dispo\":%d}", t, d }' /proc/meminfo)
allume=$(cut -d. -f1 /proc/uptime)

temp=null
for z in /sys/class/thermal/thermal_zone*; do
  [ "$(cat "$z/type" 2>/dev/null)" = x86_pkg_temp ] && temp=$(( $(cat "$z/temp") / 1000 ))
done

disque() { df -Pk "$2" 2>/dev/null | awk -v n="$1" -v p="$3" 'NR==2{ printf "{\"nom\":\"%s\",\"point\":\"%s\",\"total\":%d,\"utilise\":%d}", n, p, $2, $3 }'; }
disques=$(disque SSD /volume1 /volume1)
# le Maxtor se reconnaît à son fichier .maxtor, comme dans maxtor.sh
for d in /usb/*; do
  [ -f "$d/.maxtor" ] && disques="$disques,$(disque Maxtor "$d" copies)"
done

# dumps : dernière ligne « ok » et contenu du dernier dossier
dossier=$(ls -1d $B/dumps/20??-??-?? 2>/dev/null | tail -1)
bases=0; taille=""
if [ -n "$dossier" ]; then
  bases=$(ls -1 "$dossier"/*.dump 2>/dev/null | wc -l)
  taille=$(du -sh "$dossier" | cut -f1)
fi
dump_date=$(sec "$(derniere $B/dumps/dump.log ' ok$')")

maxtor_ligne=$(grep -a ' ok ' $B/maxtor.log 2>/dev/null | tail -1)
maxtor_date=$(sec "$(printf '%s' "$maxtor_ligne" | cut -c1-19)")
maxtor_taille=$(printf '%s' "$maxtor_ligne" | sed -n 's/.*ok (\(.*\))$/\1/p')
maxtor_derniere=$(tail -1 $B/maxtor.log 2>/dev/null)

ptcg_date=$(sec "$(derniere /volume1/docker/repos/ptcg/jobs/backup.log ' OK ')")
ekus_date=$(sec "$(derniere $B/ekus/jobs.log '|{')")

conteneurs=$(docker ps -a --format '{"nom":{{json .Names}},"etat":{{json .State}},"statut":{{json .Status}}}' 2>/dev/null \
  | sort | awk 'NR > 1 { printf "," } { printf "%s", $0 }')

cat > "$DEST/etat.json.tmp" <<FIN
{
  "maj": $(date +%s),
  "allume": $allume,
  "cpu": $cpu,
  "memoire": $mem,
  "temperature": $temp,
  "disques": [$disques],
  "dump": { "date": $dump_date, "bases": $bases, "taille": $(j "$taille") },
  "maxtor": { "date": $maxtor_date, "taille": $(j "$maxtor_taille"), "derniere": $(j "$maxtor_derniere") },
  "ptcg": { "date": $ptcg_date },
  "ekus": { "date": $ekus_date },
  "conteneurs": [$conteneurs]
}
FIN
mv "$DEST/etat.json.tmp" "$DEST/etat.json"
