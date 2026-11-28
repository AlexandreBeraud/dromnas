#!/bin/bash
# Ekus : la politique Cloudflare Access « Ekus famille » laisse entrer exactement les e-mails des profils.
# Lancé par le conteneur cron toutes les 10 minutes. N'écrit dans le journal que s'il y a un écart.
# EKUS_ACCES_ACTIF vide : écrit seulement ce qu'il changerait. 1 : l'applique.
# A la main : sudo docker exec cron bash /backup/ekus-acces.sh
set -uo pipefail

quand() { date '+%F %T'; }
arret() { echo "$(quand) arrêt : $1"; exit 1; }

# pas encore réglé dans le .env : rien à faire, sans bruit
[ -n "${CF_ACCESS_TOKEN:-}" ] && [ -n "${CF_ACCOUNT_ID:-}" ] && [ -n "${CF_EKUS_POLICY_ID:-}" ] || exit 0

api="https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/access/policies/$CF_EKUS_POLICY_ID"

voulus=$(docker exec db psql -U drom -d ekus -v ON_ERROR_STOP=1 -Atc "select e from ekus_prive.emails_autorises() e") \
  || arret "lecture des profils impossible"
voulus=$(printf '%s\n' "$voulus" | sed '/^$/d' | sort -u)
responsable=$(docker exec db psql -U drom -d ekus -Atc "select email from v2.profils where responsable") \
  || arret "lecture du responsable impossible"

# jamais une liste sans le responsable : il ne pourrait plus entrer pour réparer
[ -n "$responsable" ] || arret "le responsable n'a pas d'e-mail dans Ekus"
grep -qxF "$responsable" <<<"$voulus" || arret "l'e-mail du responsable manque"

politique=$(curl -fsS --max-time 30 -H "Authorization: Bearer $CF_ACCESS_TOKEN" "$api") \
  || arret "lecture de la politique Cloudflare impossible (jeton, identifiants ?)"
jq -e '.success' >/dev/null <<<"$politique" || arret "Cloudflare refuse : $(jq -c '.errors' <<<"$politique")"

actuels=$(jq -r '.result.include[]? | .email.email // empty' <<<"$politique" | tr '[:upper:]' '[:lower:]' | sort -u)
[ "$actuels" = "$voulus" ] && exit 0

ajouts=$(comm -13 <(printf '%s\n' "$actuels") <(printf '%s\n' "$voulus") | sed '/^$/d' | paste -sd ' ')
retraits=$(comm -23 <(printf '%s\n' "$actuels") <(printf '%s\n' "$voulus") | sed '/^$/d' | paste -sd ' ')

if [ "${EKUS_ACCES_ACTIF:-}" != "1" ]; then
  echo "$(quand) simulation : ajouterait [${ajouts}] retirerait [${retraits}]"
  exit 0
fi

# les règles qui ne sont pas des e-mails restent telles quelles ; seuls les e-mails sont remplacés
emails=$(printf '%s\n' "$voulus" | jq -R '{email: {email: .}}' | jq -s .)
corps=$(jq --argjson emails "$emails" \
  '.result | del(.id, .uid, .created_at, .updated_at, .app_count, .reusable)
   | .include = ([.include[]? | select(has("email") | not)] + $emails)' <<<"$politique")

reponse=$(curl -sS --max-time 30 -X PUT -H "Authorization: Bearer $CF_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' --data "$corps" "$api") || arret "envoi à Cloudflare impossible"
jq -e '.success' >/dev/null <<<"$reponse" || arret "Cloudflare refuse la mise à jour : $(jq -c '.errors' <<<"$reponse")"
echo "$(quand) ok : ajouté [${ajouts}] retiré [${retraits}]"
