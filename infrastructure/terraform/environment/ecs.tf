resource "aws_ecs_cluster" "main" { name = local.name }
resource "aws_cloudwatch_log_group" "containers" {
  for_each          = toset(["api", "worker", "migration"])
  name              = "/ecs/${local.name}/${each.key}"
  retention_in_days = var.log_retention_days
}
locals {
  environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "PORT", value = "3000" },
    { name = "CLIENT_ORIGIN", value = "https://${aws_cloudfront_distribution.main.domain_name}" },
    { name = "AWS_REGION", value = var.region },
    { name = "DB_HOST", value = aws_db_instance.main.address },
    { name = "DB_PORT", value = "5432" },
    { name = "DB_NAME", value = aws_db_instance.main.db_name },
    { name = "DB_SSL_CA_FILE", value = "/app/rds-ca.pem" },
    { name = "DB_POOL_MAX", value = "5" },
    { name = "CACHE_ENABLED", value = "false" },
    { name = "ENABLE_API_DOCS", value = "false" },
    { name = "DYNAMODB_ACTIVITY_TABLE", value = aws_dynamodb_table.activity.name },
    { name = "TRUSTED_PROXY_CIDRS", value = join(",", aws_subnet.public[*].cidr_block) },
    { name = "CLOUDFRONT_PROXY_CIDRS", value = join(",", sort([for entry in data.aws_ec2_managed_prefix_list.cloudfront.entries : entry.cidr])) }
  ]
  secrets = [
    { name = "DB_USER", valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:username::" },
    { name = "DB_PASSWORD", valueFrom = "${aws_db_instance.main.master_user_secret[0].secret_arn}:password::" }
  ]
  commands = {
    api       = ["node", "server/dist/server.js"]
    worker    = ["node", "server/dist/workers/start.js"]
    migration = ["node", "server/dist/database/migrate.js"]
  }
}
resource "aws_ecs_task_definition" "main" {
  for_each                 = local.commands
  family                   = "${local.name}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.task_cpu)
  memory                   = tostring(var.task_memory)
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.application.arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }
  container_definitions = jsonencode([merge({
    name                   = each.key
    image                  = var.image_uri
    essential              = true
    command                = each.value
    environment            = local.environment
    secrets                = local.secrets
    readonlyRootFilesystem = true
    stopTimeout            = 30
    linuxParameters        = { initProcessEnabled = true }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.containers[each.key].name
        awslogs-region        = var.region
        awslogs-stream-prefix = each.key
      }
    }
    }, jsondecode(each.key == "api" ? jsonencode({
      portMappings = [{ containerPort = 3000, hostPort = 3000, protocol = "tcp" }]
      healthCheck = {
        command     = ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/v1/health/ready').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
  }) : "{}"))])
  lifecycle {
    precondition {
      condition     = startswith(var.image_uri, "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.region}.amazonaws.com/${local.name}:")
      error_message = "Image must be from this account, region and environment's bootstrap repository."
    }
  }
  depends_on = [aws_iam_role_policy.execution, aws_iam_role_policy.application]
}
resource "aws_ecs_service" "main" {
  for_each                           = toset(["api", "worker"])
  name                               = "${local.name}-${each.key}"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.main[each.key].arn
  desired_count                      = var.services_enabled ? (each.key == "worker" ? var.worker_desired_count : 1) : 0
  launch_type                        = "FARGATE"
  platform_version                   = "1.4.0"
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = each.key == "api" ? 90 : null
  wait_for_steady_state              = true
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = true
  }
  dynamic "load_balancer" {
    for_each = each.key == "api" ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.api.arn
      container_name   = "api"
      container_port   = 3000
    }
  }
  depends_on = [aws_lb_listener.api, aws_route.internet]
}
