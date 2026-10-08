#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
TAG="${1:-$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)}"
[[ "$TAG" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ && "$TAG" != latest ]] || { echo 'Pass a release tag or use a Git SHA; latest is forbidden.' >&2; exit 1; }
cd "$ROOT"
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
REPOSITORY="$(terraform -chdir="$BOOTSTRAP" output -raw ecr_repository_url)"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REGION="$(printf '%s' "$REPOSITORY" | cut -d. -f4)"
[[ "$REPOSITORY" == "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/"* ]] || { echo 'ECR repository account mismatch' >&2; exit 1; }
export AWS_REGION="$REGION"
REGISTRY="${REPOSITORY%%/*}"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"
IMAGE="$REPOSITORY:$TAG"
docker build --platform linux/amd64 --tag "$IMAGE" "$ROOT"
docker push "$IMAGE"
printf '%s\n' "$IMAGE"
