terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Lấy danh sách Availability Zones khả dụng trong Region
data "aws_availability_zones" "available" {
  state = "available"
}

# 1. Mạng ảo VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project_name}-vpc"
    Environment = var.environment
  }
}

# 2. Internet Gateway cho VPC
resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# 3. Public Subnets (Dành cho EC2 kết nối Internet)
resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-subnet-1"
  }
}

resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = data.aws_availability_zones.available.names[1]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-subnet-2"
  }
}

# 4. Private Subnets (Dành cho RDS PostgreSQL bảo mật)
resource "aws_subnet" "private_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = {
    Name = "${var.project_name}-private-subnet-1"
  }
}

resource "aws_subnet" "private_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.12.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]

  tags = {
    Name = "${var.project_name}-private-subnet-2"
  }
}

# 5. Route Table cho Public Subnet ra Internet
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

# 6. Security Group cho EC2 Instance
resource "aws_security_group" "ec2_sg" {
  name        = "${var.project_name}-ec2-sg"
  description = "Cho phep SSH va HTTP truy cap EC2"
  vpc_id      = aws_vpc.main.id

  # SSH (Port 22)
  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Node App (Port 3000)
  ingress {
    description = "App port 3000"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP (Port 80)
  ingress {
    description = "HTTP access"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound all
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ec2-sg"
  }
}

# 7. Security Group cho RDS (Chỉ chấp nhận kết nối từ EC2 Security Group)
resource "aws_security_group" "rds_sg" {
  name        = "${var.project_name}-rds-sg"
  description = "Chi cho phep EC2 ket noi PostgreSQL 5432"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-rds-sg"
  }
}

# 8. DB Subnet Group cho RDS
resource "aws_db_subnet_group" "rds_subnets" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = [aws_subnet.private_1.id, aws_subnet.private_2.id]

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

# 9. RDS PostgreSQL Instance
resource "aws_db_instance" "postgres" {
  identifier             = "${var.project_name}-postgres"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  storage_type           = "gp3"
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.rds_subnets.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  publicly_accessible    = false
  skip_final_snapshot    = true
  deletion_protection    = false

  tags = {
    Name = "${var.project_name}-postgres"
  }
}

# 10. SSH Key Pair (Tự sinh private key nếu bật var.create_ssh_key)
resource "tls_private_key" "ssh_key" {
  count     = var.create_ssh_key ? 1 : 0
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "generated_key" {
  count      = var.create_ssh_key ? 1 : 0
  key_name   = var.key_name
  public_key = tls_private_key.ssh_key[0].public_key_openssh
}

resource "local_file" "private_key_pem" {
  count           = var.create_ssh_key ? 1 : 0
  content         = tls_private_key.ssh_key[0].private_key_pem
  filename        = "${path.module}/${var.key_name}.pem"
  file_permission = "0400"
}

# 11. AMI Ubuntu 22.04 LTS mới nhất
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# 12. EC2 Instance
resource "aws_instance" "app_server" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public_1.id
  vpc_security_group_ids      = [aws_security_group.ec2_sg.id]
  key_name                    = var.create_ssh_key ? aws_key_pair.generated_key[0].key_name : var.key_name
  associate_public_ip_address = true

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  user_data = <<-EOF
              #!/bin/bash
              set -e

              # 1. Cài đặt Docker và Compose
              apt-get update -y
              apt-get install -y ca-certificates curl gnupg lsb-release
              install -m 0755 -d /etc/apt/keyrings
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
              chmod a+r /etc/apt/keyrings/docker.gpg
              echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
              apt-get update -y
              apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
              usermod -aG docker ubuntu

              # 2. Thư mục deploy & RDS CA Cert
              mkdir -p /opt/testdemo/certs
              curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /opt/testdemo/certs/global-bundle.pem
              chmod 644 /opt/testdemo/certs/global-bundle.pem

              # 3. Tạo docker-compose.yml
              cat <<'DOCKERCOMPOSE' > /opt/testdemo/docker-compose.yml
              services:
                app:
                  image: $${IMAGE_NAME:-testdemo:latest}
                  ports:
                    - "3000:3000"
                  environment:
                    PORT: 3000
                    NODE_ENV: production
                    DATABASE_URL: $${DATABASE_URL:?Set DATABASE_URL}
                    DATABASE_CA_CERT: /run/secrets/rds-ca
                    ADMIN_NAME: $${ADMIN_NAME:-}
                    ADMIN_EMAIL: $${ADMIN_EMAIL:-}
                    ADMIN_PASSWORD: $${ADMIN_PASSWORD:-}
                  secrets:
                    - rds-ca
                  restart: unless-stopped

              secrets:
                rds-ca:
                  file: $${RDS_CA_CERT_PATH:?Set RDS_CA_CERT_PATH}
              DOCKERCOMPOSE

              # 4. Tạo .env với kết nối RDS thực tế
              cat <<ENVEOF > /opt/testdemo/.env
              IMAGE_NAME=${var.github_repo_image}
              DATABASE_URL=postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${var.db_name}?sslmode=require
              RDS_CA_CERT_PATH=/opt/testdemo/certs/global-bundle.pem
              ADMIN_NAME=Store Admin
              ADMIN_EMAIL=${var.admin_email}
              ADMIN_PASSWORD=${var.admin_password}
              ENVEOF

              chown -R ubuntu:ubuntu /opt/testdemo
              EOF

  tags = {
    Name = "${var.project_name}-ec2"
  }

  depends_on = [aws_db_instance.postgres]
}

