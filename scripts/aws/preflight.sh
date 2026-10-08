#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
for tool in aws terraform docker node npm curl python3; do
  command -v "$tool" >/dev/null || { echo "Missing tool: $tool" >&2; exit 1; }
done
node -e 'if (+process.versions.node.split(".")[0] !== 24) process.exit(1)'
[[ "$(npm --version)" == 11.* ]] || { echo 'npm 11 required' >&2; exit 1; }
[[ "$(aws --version 2>&1)" == aws-cli/2.* ]] || { echo 'AWS CLI v2 required' >&2; exit 1; }
terraform version -json | python3 -c 'import json,sys; v=tuple(map(int,json.load(sys.stdin)["terraform_version"].split(".")[:2])); sys.exit(not ((1,6)<=v<(2,0)))'
docker info --format '{{.ServerVersion}}'
aws sts get-caller-identity
printf 'AWS region: %s\n' "$AWS_REGION"
printf 'Preflight passed; no AWS resources modified.\n'
