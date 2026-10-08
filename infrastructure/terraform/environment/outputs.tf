output "application_url" { value = "https://${aws_cloudfront_distribution.main.domain_name}" }
output "cloudfront_domain" { value = aws_cloudfront_distribution.main.domain_name }
output "cloudfront_distribution_id" { value = aws_cloudfront_distribution.main.id }
output "alb_dns" { value = aws_lb.api.dns_name }
output "ecs_cluster_name" { value = aws_ecs_cluster.main.name }
output "ecs_service_name" { value = aws_ecs_service.main["api"].name }
output "ecs_worker_service_name" { value = aws_ecs_service.main["worker"].name }
output "migration_task_definition" { value = aws_ecs_task_definition.main["migration"].arn }
output "migration_network_configuration" {
  value = { awsvpcConfiguration = {
    subnets        = aws_subnet.public[*].id
    securityGroups = [aws_security_group.tasks.id]
    assignPublicIp = "ENABLED"
  } }
}
output "rds_endpoint" { value = aws_db_instance.main.endpoint }
output "dynamodb_table_name" { value = aws_dynamodb_table.activity.name }
output "frontend_bucket_name" { value = aws_s3_bucket.frontend.id }
output "region" { value = var.region }

output "ecr_repository_url" { value = split(":", var.image_uri)[0] }
