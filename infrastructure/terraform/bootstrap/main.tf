terraform {
  required_version = ">= 1.6, < 2.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}
variable "region" { default = "ap-south-1" }
variable "environment" { default = "demo" }
provider "aws" {
  region = var.region
  default_tags {
    tags = { Project = "cloudops-content-platform", Environment = var.environment, ManagedBy = "terraform" }
  }
}
resource "aws_ecr_repository" "backend" {
  name                 = "cloudops-content-platform-${var.environment}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false
  encryption_configuration { encryption_type = "AES256" }
  image_scanning_configuration { scan_on_push = true }
}
output "ecr_repository_url" { value = aws_ecr_repository.backend.repository_url }
