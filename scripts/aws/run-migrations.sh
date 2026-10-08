#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
use_stack_region
CLUSTER="$(output ecs_cluster_name)"
DEFINITION="$(output migration_task_definition)"
NETWORK="$(terraform -chdir="$ENVIRONMENT" output -json migration_network_configuration)"
RESULT="$(aws ecs run-task --cluster "$CLUSTER" --launch-type FARGATE --platform-version 1.4.0 --task-definition "$DEFINITION" --network-configuration "$NETWORK" --count 1 --output json)"
TASK="$(printf '%s' "$RESULT" | python3 -c 'import json,sys; r=json.load(sys.stdin); f=r.get("failures",[]); tasks=r.get("tasks",[]); sys.exit("Migration launch failed: "+str(f)) if f or len(tasks)!=1 else print(tasks[0]["taskArn"])')"
printf 'Migration task: %s\n' "$TASK"
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK"
aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK" --output json | python3 -c 'import json,sys; r=json.load(sys.stdin); t=r.get("tasks",[]); cs=t[0].get("containers",[]) if len(t)==1 else []; ok=not r.get("failures") and len(cs)==1 and cs[0].get("exitCode")==0; print("Migration succeeded" if ok else "Migration failed; inspect the migration CloudWatch log group and task stoppedReason."); sys.exit(0 if ok else 1)'
