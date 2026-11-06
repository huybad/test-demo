output "ec2_public_ip" {
  description = "Địa chỉ IPv4 Public của máy chủ EC2"
  value       = aws_instance.app_server.public_ip
}

output "rds_endpoint" {
  description = "Endpoint kết nối RDS PostgreSQL"
  value       = aws_db_instance.postgres.endpoint
}

output "database_url" {
  description = "Chuỗi kết nối DATABASE_URL"
  value       = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${var.db_name}?sslmode=require"
  sensitive   = true
}

output "ssh_command" {
  description = "Lệnh SSH trực tiếp vào EC2 server"
  value       = var.create_ssh_key ? "ssh -i ${var.key_name}.pem ubuntu@${aws_instance.app_server.public_ip}" : "ssh -i <your-key>.pem ubuntu@${aws_instance.app_server.public_ip}"
}

output "web_url" {
  description = "Đường dẫn truy cập ứng dụng web"
  value       = "http://${aws_instance.app_server.public_ip}:3000"
}

output "github_actions_secrets_guide" {
  description = "Hướng dẫn cấu hình GitHub Secrets cho CI/CD"
  value = <<-EOT
  ================ GITHUB ACTIONS SECRETS ================
  Vào GitHub Repo -> Settings -> Secrets and variables -> Actions
  Thêm các Secrets sau:

  1. DEPLOY_HOST : ${aws_instance.app_server.public_ip}
  2. DEPLOY_USER : ubuntu
  3. DEPLOY_PATH : /opt/testdemo
  4. DEPLOY_KEY  : Copy toàn bộ nội dung file "${var.key_name}.pem" vừa được tạo
  ========================================================
  EOT
}

