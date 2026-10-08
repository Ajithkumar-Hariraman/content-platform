#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
use_stack_region
cd "$ROOT"
npm run build --workspace=@cloudops/client
BUCKET="$(output frontend_bucket_name)"
DISTRIBUTION="$(output cloudfront_distribution_id)"
aws s3 sync client/dist/ "s3://$BUCKET/" --exclude index.html --cache-control 'public,max-age=31536000,immutable'
aws s3 cp client/dist/index.html "s3://$BUCKET/index.html" --cache-control 'no-cache' --content-type 'text/html'
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths '/*'
printf 'Application: %s\n' "$(output application_url)"
