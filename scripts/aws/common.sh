#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BOOTSTRAP="$ROOT/infrastructure/terraform/bootstrap"
ENVIRONMENT="$ROOT/infrastructure/terraform/environment"
export AWS_PAGER=""
export AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"
output() { terraform -chdir="$ENVIRONMENT" output -raw "$1"; }
use_stack_region() { export AWS_REGION="$(output region)"; }
