#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
URL="${1:?Usage: smoke-test.sh https://CLOUDFRONT-DOMAIN}"
[[ "$URL" == https://* ]] || { echo 'HTTPS URL required' >&2; exit 1; }
URL="${URL%/}"
curl --fail --silent --show-error --retry 3 --max-time 30 "$URL/" | python3 -c 'import sys; s=sys.stdin.read(); assert "<html" in s.lower() and "id=\"root\"" in s, "Frontend is not React HTML"'
for path in /api/v1/health/live /api/v1/health/ready /api/v1/products /api/v1/content; do
  curl --fail --silent --show-error --retry 3 --max-time 30 "$URL$path" | python3 -c 'import json,sys; r=json.load(sys.stdin); assert isinstance(r,dict); assert r.get("status") in ["ok", "ready"] or (isinstance(r.get("data"),list) and "pagination" in r), "Unexpected API response"'
  printf 'PASS %s\n' "$path"
done
curl --fail --silent --show-error --max-time 30 "$URL/products/example-deep-route" | python3 -c 'import sys; assert "id=\"root\"" in sys.stdin.read(), "SPA deep route failed"'
CODE="$(curl --silent --show-error --max-time 30 --output /dev/null --write-out '%{http_code}' "$URL/api/v1/not-a-route")"
[[ "$CODE" == 404 ]] || { echo "API 404 was changed to $CODE" >&2; exit 1; }
printf 'Production smoke checks passed.\n'
