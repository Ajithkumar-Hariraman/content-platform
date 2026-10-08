terraform {
  required_version = ">= 1.6, < 2.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}
provider "aws" {
  region = var.region
  default_tags { tags = local.tags }
}
data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
data "aws_availability_zones" "available" { state = "available" }
locals {
  name = "cloudops-content-platform-${var.environment}"
  tags = { Project = "cloudops-content-platform", Environment = var.environment, ManagedBy = "terraform" }
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)
}
