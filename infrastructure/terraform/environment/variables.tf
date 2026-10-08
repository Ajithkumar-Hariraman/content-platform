variable "region" { default = "ap-south-1" }
variable "environment" {
  default = "demo"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,11}$", var.environment))
    error_message = "Environment must be a short lowercase identifier."
  }
}
variable "image_uri" {
  type = string
  validation {
    condition     = can(regex("^[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/cloudops-content-platform-[a-z0-9-]+:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$", var.image_uri)) && !endswith(var.image_uri, ":latest")
    error_message = "Provide the versioned ECR image URI; latest is forbidden."
  }
}
variable "services_enabled" {
  type        = bool
  default     = false
  description = "Enable only after the one-off migration task succeeds."
}
variable "db_instance_class" { default = "db.t4g.micro" }
variable "db_engine_version" { default = "16" }
variable "task_cpu" { default = 256 }
variable "task_memory" { default = 512 }
variable "log_retention_days" { default = 7 }
variable "budget_email" {
  default  = null
  type     = string
  nullable = true
}
variable "budget_amount_usd" { default = "30" }
variable "force_destroy_frontend" {
  type    = bool
  default = false
}
variable "skip_final_snapshot" {
  type    = bool
  default = false
}
variable "final_snapshot_identifier" {
  type        = string
  default     = null
  nullable    = true
  description = "Unique final snapshot name required for destroy unless skip_final_snapshot is explicitly enabled."
}

variable "worker_desired_count" {
  type        = number
  default     = 1
  description = "Demo worker count when services are enabled; zero temporarily disables delivery."
  validation {
    condition     = contains([0, 1], var.worker_desired_count)
    error_message = "Demo worker count must be zero or one."
  }
}
