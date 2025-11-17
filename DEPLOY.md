# คำแนะนำการ Deploy บน Server

## Server Information
- IP Address: 192.168.100.124

## ขั้นตอนการ Deploy

### 1. เตรียม Server

```bash
# ติดตั้ง Docker และ Docker Compose (ถ้ายังไม่มี)
# สำหรับ Ubuntu/Debian:
sudo apt-get update
sudo apt-get install -y docker.io docker-compose

# เริ่ม Docker service
sudo systemctl start docker
sudo systemctl enable docker
```

### 2. Upload โค้ดไปยัง Server

```bash
# จากเครื่อง local (ใช้ scp หรือ rsync)
scp -r . user@192.168.100.124:/path/to/wms_vmi_bpi_backend

# หรือใช้ Git
git clone <repository-url>
cd wms_vmi_bpi_backend
```

### 3. Build และ Run Docker Containers

```bash
# SSH เข้าไปที่ server
ssh user@192.168.100.124

# ไปที่ directory ของโปรเจค
cd /path/to/wms_vmi_bpi_backend

# Build และ start containers
docker-compose -f docker-compose.prod.yml up -d --build

# ดู logs
docker-compose -f docker-compose.prod.yml logs -f

# ตรวจสอบ status
docker-compose -f docker-compose.prod.yml ps
```

### 4. ตรวจสอบการทำงาน

```bash
# ตรวจสอบว่า containers ทำงานอยู่
docker ps

# ตรวจสอบ backend API
curl http://localhost:3001

# หรือจากเครื่องอื่น
curl http://192.168.100.124:3001
```

### 5. คำสั่งที่มีประโยชน์

```bash
# หยุด containers
docker-compose -f docker-compose.prod.yml down

# หยุดและลบ volumes (⚠️ ข้อมูลจะหาย)
docker-compose -f docker-compose.prod.yml down -v

# Restart containers
docker-compose -f docker-compose.prod.yml restart

# ดู logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f db

# Rebuild และ restart
docker-compose -f docker-compose.prod.yml up -d --build --force-recreate
```

### 6. Firewall Configuration

ถ้า server มี firewall ต้องเปิด port:

```bash
# สำหรับ Ubuntu/Debian (ufw)
sudo ufw allow 3001/tcp
sudo ufw allow 1433/tcp

# สำหรับ CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --add-port=1433/tcp
sudo firewall-cmd --reload
```

### 7. Auto-start เมื่อ Server Restart

Docker containers จะ auto-start อัตโนมัติเพราะมี `restart: unless-stopped` ใน docker-compose.yml

### 8. Backup Database

```bash
# Backup database volume
docker run --rm -v wms_vmi_bpi_backend_db_data:/data -v $(pwd):/backup alpine tar czf /backup/db_backup_$(date +%Y%m%d_%H%M%S).tar.gz /data

# Restore database
docker run --rm -v wms_vmi_bpi_backend_db_data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/db_backup_YYYYMMDD_HHMMSS.tar.gz"
```

## Troubleshooting

### ตรวจสอบ logs
```bash
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs db
```

### ตรวจสอบ network
```bash
docker network ls
docker network inspect wms_vmi_bpi_backend_wms_network
```

### ตรวจสอบ volumes
```bash
docker volume ls
docker volume inspect wms_vmi_bpi_backend_db_data
```

### Restart containers
```bash
docker-compose -f docker-compose.prod.yml restart
```

