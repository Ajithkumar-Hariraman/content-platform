# AWS deployment

Run commands from the repository root. Required: Node 24, npm 11, Docker Engine, AWS CLI v2, Terraform >=1.6 and <2, curl, Python 3 and AWS credentials with permission to provision the documented resources and pass the ECS roles. Use an isolated demo account. Preflight is read-only; it prints the authenticated account and region. Scripts use the normal AWS credential chain and never embed credentials.

## Current verification status

The Phase 7 container, both Terraform stacks, production database/proxy configuration, and preflight/image/frontend/migration/smoke scripts already exist. On 2026-10-08, formatting, lint, typecheck, React/server builds, the linux/amd64 Docker build, shell syntax checks, Terraform formatting and validation of both stacks passed. Client tests passed 6/6; server tests passed 104 with 7 dependency integration tests skipped because their test endpoints were not configured. Terraform reported DynamoDB key argument deprecation warnings; the client build reported a bundle size warning.

AWS provisioning, migration execution, service rollout and CloudFront smoke verification remain pending. Preflight currently stops at `Missing tool: aws`; Terraform was validated using `/tmp/cloudops-tools/terraform` and is not on the default PATH. No standard AWS credential environment, selected profile or shared credentials file was found, and neither stack has deployment state. Install AWS CLI v2, configure the intended account credentials and put Terraform on PATH, then run `bash scripts/aws/preflight.sh` before following the bootstrap workflow below. No AWS resources were deployed during this verification.

## Local gate and bootstrap

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
export AWS_REGION=ap-south-1
bash scripts/aws/preflight.sh
terraform -chdir=infrastructure/terraform/bootstrap init
terraform -chdir=infrastructure/terraform/bootstrap apply -var="region=$AWS_REGION"
bash scripts/aws/build-push-image.sh phase7-v1
```

Use an explicit new release tag or a Git SHA. ECR tags are immutable; never reuse a pushed tag. The image script repeats local checks before uploading. DATABASE_URL is for local use; production uses the complete DB_HOST/PORT/NAME/USER/PASSWORD set and DB_SSL_CA_FILE. Local DATABASE_URL and DB_* values cannot be combined. Integration tests need TEST_DATABASE_URL, TEST_DYNAMODB_ENDPOINT and optionally TEST_REDIS_URL; a skipped dependency test is not an AWS verification.

## Provision and migrate

Set the exact URI printed by the image script. Terraform remains visible; no wrapper creates AWS resources outside Terraform.

```bash
export TF_VAR_image_uri="$(terraform -chdir=infrastructure/terraform/bootstrap output -raw ecr_repository_url):phase7-v1"
export TF_VAR_region="$AWS_REGION"
terraform -chdir=infrastructure/terraform/environment init
terraform -chdir=infrastructure/terraform/environment plan -var='services_enabled=false'
terraform -chdir=infrastructure/terraform/environment apply -var='services_enabled=false'
bash scripts/aws/run-migrations.sh
terraform -chdir=infrastructure/terraform/environment apply -var='services_enabled=true'
bash scripts/aws/deploy-frontend.sh
bash scripts/aws/smoke-test.sh "$(terraform -chdir=infrastructure/terraform/environment output -raw application_url)"
```

The initial apply creates task definitions and zero-count services. The migration script launches exactly one isolated Fargate migration task, waits for STOPPED and requires exitCode=0. Only after success enable services. Migrations use PostgreSQL advisory locking and checksum tracking. API and worker startup never run migrations or seeds. Seeds are excluded from the image and production seed commands remain prohibited. Empty public product/content lists are expected on a fresh database; smoke tests require successful API responses, not seeded fixtures.

For later releases, leave services enabled with the existing image, build/push the new tag, then stage only the migration definition:

```bash
export TF_VAR_image_uri="$(terraform -chdir=infrastructure/terraform/bootstrap output -raw ecr_repository_url):phase7-v2"
terraform -chdir=infrastructure/terraform/environment apply -var='services_enabled=true' -target='aws_ecs_task_definition.main["migration"]'
bash scripts/aws/run-migrations.sh
terraform -chdir=infrastructure/terraform/environment apply -var='services_enabled=true'
bash scripts/aws/deploy-frontend.sh
```

Targeted apply is intentionally limited to staging the migration revision before the full apply updates API and worker. Review its plan and the subsequent full plan. Use backward-compatible additive schema changes so existing tasks keep working while migrations run. Do not proceed after a migration failure; inspect `/ecs/cloudops-content-platform-demo/migration` and the task stopped reason. The ECS waiter can time out while the task continues; inspect the recorded task ARN before retrying. Terraform waits for steady state, but verify actual running task image/revision and application behavior after circuit-breaker rollback.

## Validation and rollback

```bash
terraform fmt -check -recursive infrastructure/terraform
terraform -chdir=infrastructure/terraform/bootstrap init -backend=false
terraform -chdir=infrastructure/terraform/bootstrap validate
terraform -chdir=infrastructure/terraform/environment init -backend=false
terraform -chdir=infrastructure/terraform/environment validate
```

CloudFront deployment and invalidations take time. Smoke tests check frontend HTML, live/ready, public products/content, a SPA deep route and preservation of API 404. Authentication remains tested locally without adding administrator credentials to scripts. Roll back by setting TF_VAR_image_uri to a previous immutable image and applying with services_enabled=true. Database migrations are not automatically reversed; retain backward-compatible schemas or restore an RDS snapshot after a separate reviewed recovery plan. Frontend sync uploads assets before index.html and retains older hashed assets so cached clients and frontend rollbacks continue working.

## State and teardown

Both stacks initially use local Terraform state. Keep state and lock files secure, never commit state/plans/tfvars/secrets, and commit `.terraform.lock.hcl` provider locks. For collaboration migrate each stack to a separately provisioned secure backend; do not create unmanaged backend resources as part of this deployment. Preserve local state securely until destruction completes.

RDS retains a final snapshot by default. Set a unique final_snapshot_identifier before destroy (the default name can collide on a repeated teardown). The frontend bucket defaults to refusing destruction while it contains files. To explicitly delete this demo bucket's objects through Terraform, apply force_destroy_frontend=true, then destroy. Snapshots retained on teardown continue to incur storage charges. ECR similarly refuses destruction while nonempty; deliberately remove only this repository's images or explicitly change its Terraform force_delete setting for a disposable teardown. Do not delete unrelated resources.

```bash
terraform -chdir=infrastructure/terraform/environment apply -var='services_enabled=false' -var='force_destroy_frontend=true' -var="final_snapshot_identifier=cloudops-demo-final-$(date -u +%Y%m%d%H%M%S)"
terraform -chdir=infrastructure/terraform/environment destroy
terraform -chdir=infrastructure/terraform/bootstrap destroy
```

Keep TF_VAR_image_uri and TF_VAR_region set through teardown. To discard the demo database instead of retaining a final snapshot, explicitly apply skip_final_snapshot=true before destroy. Understand the data loss before doing so. Review every plan. Budget alerts do not stop charges.
