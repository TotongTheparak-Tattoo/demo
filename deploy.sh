#!/bin/bash

# Script สำหรับ deploy บน server
# ใช้งาน: ./deploy.sh

set -e

echo "=========================================="
echo "WMS Backend Docker Deploy Script"
echo "=========================================="

# ตรวจสอบว่า Docker ทำงานอยู่หรือไม่
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# ตรวจสอบว่า docker-compose ใช้งานได้หรือไม่
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

echo "✅ docker-compose is available"

# Stop containers ถ้ามีอยู่แล้ว
echo ""
echo "Stopping existing containers (if any)..."
docker-compose -f docker-compose.prod.yml down || true

# Build และ start containers
echo ""
echo "Building and starting containers..."
docker-compose -f docker-compose.prod.yml up -d --build

# รอให้ containers พร้อม
echo ""
echo "Waiting for containers to be ready..."
sleep 10

# ตรวจสอบ status
echo ""
echo "Container status:"
docker-compose -f docker-compose.prod.yml ps

# แสดง logs
echo ""
echo "=========================================="
echo "Recent logs (last 20 lines):"
echo "=========================================="
docker-compose -f docker-compose.prod.yml logs --tail=20

echo ""
echo "=========================================="
echo "✅ Deploy completed!"
echo "=========================================="
echo ""
echo "Backend API: http://localhost:3001"
echo "SQL Server: localhost:1433"
echo ""
echo "To view logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "To stop: docker-compose -f docker-compose.prod.yml down"
echo ""

