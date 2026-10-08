resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.database[*].id
}
resource "aws_db_parameter_group" "main" {
  name_prefix = "${local.name}-"
  family      = "postgres${split(".", var.db_engine_version)[0]}"
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
  lifecycle { create_before_destroy = true }
}
resource "aws_db_instance" "main" {
  identifier                  = local.name
  engine                      = "postgres"
  engine_version              = var.db_engine_version
  instance_class              = var.db_instance_class
  allocated_storage           = 20
  max_allocated_storage       = 30
  storage_type                = "gp3"
  storage_encrypted           = true
  db_name                     = "cloudops"
  username                    = "cloudops_admin"
  manage_master_user_password = true
  db_subnet_group_name        = aws_db_subnet_group.main.name
  parameter_group_name        = aws_db_parameter_group.main.name
  vpc_security_group_ids      = [aws_security_group.database.id]
  publicly_accessible         = false
  multi_az                    = false
  backup_retention_period     = 3
  auto_minor_version_upgrade  = true
  copy_tags_to_snapshot       = true
  ca_cert_identifier          = "rds-ca-rsa2048-g1"
  skip_final_snapshot         = var.skip_final_snapshot
  final_snapshot_identifier   = coalesce(var.final_snapshot_identifier, "${local.name}-final")
}
resource "aws_dynamodb_table" "activity" {
  name         = "${local.name}-activity"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"
  dynamic "attribute" {
    for_each = toset(["pk", "sk", "gsiPk", "gsiSk"])
    content {
      name = attribute.value
      type = "S"
    }
  }
  global_secondary_index {
    name            = "recent_activity"
    hash_key        = "gsiPk"
    range_key       = "gsiSk"
    projection_type = "ALL"
  }
  server_side_encryption { enabled = true }
}
resource "aws_budgets_budget" "demo" {
  count        = var.budget_email == null ? 0 : 1
  name         = "${local.name}-monthly"
  budget_type  = "COST"
  limit_amount = var.budget_amount_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_email]
  }
}
