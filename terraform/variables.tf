variable "aws_region" {
  description = "AWS Region để triển khai hạ tầng"
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Tên môi trường (production / staging)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Tên dự án"
  type        = string
  default     = "testdemo"
}

variable "instance_type" {
  description = "Loại máy chủ EC2 (t3.micro hoặc t2.micro thuộc AWS Free Tier)"
  type        = string
  default     = "t3.micro"
}

variable "create_ssh_key" {
  description = "Tự động tạo SSH Key Pair mới và lưu file .pem về máy cục bộ"
  type        = bool
  default     = true
}

variable "key_name" {
  description = "Tên của SSH Key Pair trên AWS"
  type        = string
  default     = "testdemo-key"
}

variable "db_name" {
  description = "Tên database PostgreSQL"
  type        = string
  default     = "testdemo"
}

variable "db_username" {
  description = "Username quản trị PostgreSQL"
  type        = string
  default     = "testdemo_user"
}

variable "db_password" {
  description = "Mật khẩu database (tối thiểu 8 ký tự)"
  type        = string
  sensitive   = true
  default     = "TestDemoStrongPass2026!"
}

variable "db_instance_class" {
  description = "Loại máy chủ RDS (db.t3.micro hoặc db.t4g.micro)"
  type        = string
  default     = "db.t3.micro"
}

variable "github_repo_image" {
  description = "Đường dẫn image trên GitHub Container Registry (ví dụ: ghcr.io/<username>/testdemo:latest)"
  type        = string
  default     = "ghcr.io/your-github-username/testdemo:latest"
}

variable "admin_email" {
  description = "Email tài khoản quản trị hệ thống"
  type        = string
  default     = "admin@example.com"
}

variable "admin_password" {
  description = "Mật khẩu tài khoản quản trị hệ thống (tối thiểu 12 ký tự)"
  type        = string
  sensitive   = true
  default     = "AdminSecurePassword2026!"
}

