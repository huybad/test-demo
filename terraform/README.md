# Hướng Dẫn Triển Khai AWS Cho Dự Án TestDemo

Thư mục này chứa toàn bộ mã nguồn **Terraform (Infrastructure as Code - IaC)** giúp bạn tự động tạo toàn bộ hạ tầng AWS chỉ với **1 lệnh duy nhất**.

---

## 🏗️ Kiến trúc hạ tầng AWS được tạo sẵn

1. **VPC & Subnets**:
   - 1 Virtual Private Cloud (VPC: `10.0.0.0/16`).
   - 2 Public Subnets (ở 2 Availability Zones `ap-southeast-1a` và `ap-southeast-1b`) gắn Internet Gateway.
   - 2 Private Subnets cách ly hoàn toàn với Internet dành cho cơ sở dữ liệu.
2. **Security Groups**:
   - `testdemo-ec2-sg`: Mở port `22` (SSH), `80` (HTTP), `3000` (Node.js App).
   - `testdemo-rds-sg`: Chỉ cho phép kết nối PostgreSQL qua port `5432` từ `testdemo-ec2-sg` (không lộ ra ngoài Internet).
3. **AWS RDS PostgreSQL**:
   - Bản PostgreSQL 16 (loại máy chủ `db.t3.micro` Free Tier, 20GB gp3).
   - Database name: `testdemo`.
4. **AWS EC2 Server**:
   - Ubuntu 22.04 LTS (`t3.micro` Free Tier, 20GB gp3).
   - Tự động sinh file SSH Key Pair `.pem` lưu ngay tại máy của bạn.
   - **Tự động cài đặt (User Data)**:
     - Docker & Docker Compose Plugin.
     - Tải chứng chỉ xác thực Amazon RDS CA Bundle (`global-bundle.pem`).
     - Tạo thư mục `/opt/testdemo` kèm file `docker-compose.yml` và `.env` đã điền sẵn URL kết nối tới RDS vừa tạo.

---

## 🚀 Cách 1: Triển khai tự động bằng Terraform (Khuyên dùng)

### Bước 1: Cài đặt công cụ (nếu chưa có)
- Cài đặt **AWS CLI**: [Tải tại đây](https://aws.amazon.com/cli/)
- Cài đặt **Terraform**: [Tải tại đây](https://developer.hashicorp.com/terraform/install)

### Bước 2: Cấu hình tài khoản AWS
Mở terminal và đăng nhập AWS Access Key của bạn:
```bash
aws configure
# Nhập AWS Access Key ID, AWS Secret Access Key, Default region: ap-southeast-1
```

### Bước 3: Chạy Terraform
Tại thư mục `terraform`:
```bash
cd terraform

# Tạo file cấu hình từ file mẫu (tùy chỉnh mật khẩu hoặc repo nếu muốn)
cp terraform.tfvars.example terraform.tfvars

# Khởi tạo provider
terraform init

# Xem trước các tài nguyên sẽ tạo
terraform plan

# Tạo hạ tầng AWS (gõ 'yes' khi được hỏi)
terraform apply
```

### Bước 4: Nhận kết quả và cấu hình GitHub Actions
Sau khi hoàn tất (khoảng 3 - 5 phút), terminal sẽ in ra:
- `ec2_public_ip`: IP của máy chủ EC2.
- `ssh_command`: Lệnh để bạn SSH vào server (kèm file `testdemo-key.pem` đã tự lưu trong thư mục `terraform/`).
- `web_url`: Đường dẫn truy cập web `http://<ip>:3000`.
- Hướng dẫn 4 biến Secret cần điền vào **GitHub Repository -> Settings -> Secrets and variables -> Actions**:
  - `DEPLOY_HOST`: Địa chỉ IP của EC2.
  - `DEPLOY_USER`: `ubuntu`
  - `DEPLOY_PATH`: `/opt/testdemo`
  - `DEPLOY_KEY`: Nội dung file `testdemo-key.pem`.

---

## 🛠️ Cách 2: Tạo thủ công trên AWS Console

Nếu bạn muốn tự tay bấm trên AWS Web Console:

1. **VPC**: Tạo 1 VPC kèm Internet Gateway, 1 Public Subnet, 2 Private Subnet.
2. **Security Groups**:
   - `ec2-sg`: Inbound TCP 22, 3000, 80 từ `0.0.0.0/0`.
   - `rds-sg`: Inbound TCP 5432 từ `ec2-sg`.
3. **RDS PostgreSQL**:
   - Engine: PostgreSQL 16.
   - DB Subnet Group: Chọn 2 Private Subnet.
   - Security Group: Chọn `rds-sg`.
   - Public Access: **No**.
4. **EC2 Instance**:
   - OS: Ubuntu 22.04 LTS (`t3.micro`).
   - Subnet: Public Subnet.
   - Security Group: `ec2-sg`.
   - Tải file Key Pair `.pem`.
5. **Cài đặt trên EC2**:
   - SSH vào EC2: `ssh -i your-key.pem ubuntu@<ec2-ip>`
   - Chạy script chuẩn bị môi trường:
     ```bash
     curl -fsSL https://raw.githubusercontent.com/huy2905/testdemo/main/scripts/setup-ec2.sh | bash
     ```
   - Cập nhật thông tin RDS vào file `/opt/testdemo/.env`.

---

## 🧹 Thu hồi / Xóa tài nguyên để tránh phát sinh chi phí

Khi đã học xong hoặc muốn dọn dẹp tài nguyên trên AWS:
```bash
cd terraform
terraform destroy
```

