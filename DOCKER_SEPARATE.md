# การใช้งาน Docker แยก DB และ Backend

## วิธีการใช้งาน

### ขั้นตอนที่ 1: รัน Database Container แยก

```bash
# รัน SQL Server container
docker-compose -f docker-compose.db.yml up -d

# ตรวจสอบว่า DB รันอยู่
docker ps | grep wms_db

# ดู logs
docker-compose -f docker-compose.db.yml logs -f
```

### ขั้นตอนที่ 2: รัน Backend Container (เชื่อมต่อกับ DB ที่รันอยู่แล้ว)

```bash
# รัน Backend container (จะเชื่อมต่อกับ DB ที่รันอยู่แล้ว)
docker-compose -f docker-compose.backend.yml up -d

# ตรวจสอบว่า Backend รันอยู่
docker ps | grep wms_backend

# ดู logs
docker-compose -f docker-compose.backend.yml logs -f
```

## คำสั่งที่ใช้บ่อย

### หยุดและลบ Containers

```bash
# หยุด Backend
docker-compose -f docker-compose.backend.yml down

# หยุด DB (ระวัง: จะลบข้อมูลถ้าไม่ระบุ --volumes)
docker-compose -f docker-compose.db.yml down

# หยุด DB แต่เก็บข้อมูลไว้
docker-compose -f docker-compose.db.yml down --volumes
```

### Restart Services

```bash
# Restart Backend เท่านั้น
docker-compose -f docker-compose.backend.yml restart

# Restart DB
docker-compose -f docker-compose.db.yml restart
```

### ดู Status

```bash
# ดู containers ทั้งหมด
docker ps

# ดู network
docker network ls | grep wms_network

# ตรวจสอบว่า containers เชื่อมต่อกัน
docker network inspect wms_network
```

## ข้อดีของการแยก

1. **รัน DB แยกได้** - DB สามารถรันอยู่ตลอดเวลา แม้ Backend จะ restart
2. **อัพเดท Backend ได้ง่าย** - rebuild Backend โดยไม่กระทบ DB
3. **ใช้ DB ร่วมกัน** - Backend หลายตัวสามารถเชื่อมต่อ DB เดียวกันได้
4. **จัดการแยกกัน** - สามารถ scale แต่ละ service ได้อิสระ

## หมายเหตุ

- **Network**: ทั้งสอง containers ใช้ network `wms_network` เดียวกัน
- **DB_HOST**: Backend ใช้ `DB_HOST=wms_db` (container name) เพื่อเชื่อมต่อ
- **Volume**: ข้อมูล DB เก็บใน volume `db_data` ซึ่งจะไม่หายเมื่อ restart container

## Troubleshooting

### Backend เชื่อมต่อ DB ไม่ได้

```bash
# ตรวจสอบว่า DB container รันอยู่
docker ps | grep wms_db

# ตรวจสอบ network
docker network inspect wms_network

# ตรวจสอบ logs
docker logs wms_backend
docker logs wms_db
```

### ต้องการเปลี่ยน DB Host

ถ้า DB รันอยู่ที่ host อื่น (ไม่ใช่ Docker) ให้แก้ไข `docker-compose.backend.yml`:

```yaml
environment:
  - DB_HOST=host.docker.internal  # สำหรับ Windows/Mac
  # หรือ
  - DB_HOST=172.17.0.1  # สำหรับ Linux
```

