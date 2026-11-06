#!/usr/bin/env bash
set -euo pipefail

echo "============================================="
echo "   Khởi tạo môi trường EC2 cho TestDemo     "
echo "============================================="

# 1. Cập nhật hệ thống và cài đặt công cụ cần thiết
echo "[1/5] Cập nhật gói hệ thống..."
sudo apt-get update -y
sudo apt-get install -y curl ca-certificates gnupg lsb-release git

# 2. Cài đặt Docker và Docker Compose Plugin chính thức
echo "[2/5] Cài đặt Docker & Docker Compose..."
if ! command -v docker &> /dev/null; then
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Cấp quyền docker cho user ubuntu
    sudo usermod -aG docker "${USER:-ubuntu}"
    echo "Docker đã được cài đặt thành công."
else
    echo "Docker đã tồn tại, bỏ qua bước cài đặt."
fi

# 3. Tạo thư mục chứa ứng dụng deploy
echo "[3/5] Tạo thư mục deploy tại /opt/testdemo..."
sudo mkdir -p /opt/testdemo/certs
sudo chown -R "${USER:-ubuntu}:${USER:-ubuntu}" /opt/testdemo

# 4. Tải AWS RDS CA Certificate Bundle
echo "[4/5] Tải chứng chỉ RDS CA certificate (global-bundle.pem)..."
curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /opt/testdemo/certs/global-bundle.pem
sudo chmod 644 /opt/testdemo/certs/global-bundle.pem

# 5. Khởi tạo template docker-compose.yml và .env nếu chưa có
echo "[5/5] Chuẩn bị cấu hình docker-compose và .env..."
if [ ! -f /opt/testdemo/docker-compose.yml ]; then
    if [ -f "$(dirname "$0")/../docker-compose.yml" ]; then
        cp "$(dirname "$0")/../docker-compose.yml" /opt/testdemo/docker-compose.yml
    else
        cat <<'EOF' > /opt/testdemo/docker-compose.yml
services:
  app:
    build: .
    image: ${IMAGE_NAME:-testdemo:latest}
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL:?Set DATABASE_URL in the deployment environment}
      DATABASE_CA_CERT: /run/secrets/rds-ca
      ADMIN_NAME: ${ADMIN_NAME:-}
      ADMIN_EMAIL: ${ADMIN_EMAIL:-}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}
    secrets:
      - rds-ca
    restart: unless-stopped

secrets:
  rds-ca:
    file: ${RDS_CA_CERT_PATH:?Set RDS_CA_CERT_PATH to the downloaded AWS RDS CA bundle}
EOF
    fi
fi

if [ ! -f /opt/testdemo/.env ]; then
    cat <<'EOF' > /opt/testdemo/.env
# Điền thông tin repo GitHub và RDS Endpoint thực tế của bạn:
IMAGE_NAME=ghcr.io/your-github-username/testdemo:latest
DATABASE_URL=postgresql://testdemo_user:your-db-password@your-rds-endpoint.ap-southeast-1.rds.amazonaws.com:5432/testdemo?sslmode=require
RDS_CA_CERT_PATH=/opt/testdemo/certs/global-bundle.pem
ADMIN_NAME=Store Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-password
EOF
    echo "Đã tạo file mẫu /opt/testdemo/.env. Hãy chỉnh sửa file này với thông tin RDS của bạn!"
fi

echo "============================================="
echo "   Hoàn tất thiết lập máy chủ EC2!           "
echo "============================================="
echo "Các bước tiếp theo:"
echo "1. Mở file /opt/testdemo/.env và cập nhật DATABASE_URL & IMAGE_NAME."
echo "2. Đăng nhập GitHub Container Registry (nếu image là private):"
echo "   echo \$GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin"
echo "3. Kiểm tra khởi động: cd /opt/testdemo && docker compose up -d app"

