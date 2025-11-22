#!/bin/bash

# Script สำหรับรัน Backend Container (เชื่อมต่อกับ DB ที่รันอยู่แล้ว)

echo "Checking if database is running..."
if ! docker ps | grep -q wms_db; then
    echo "ERROR: Database container (wms_db) is not running!"
    echo "Please start the database first:"
    echo "  docker-compose -f docker-compose.db.yml up -d"
    echo "  or"
    echo "  ./start-db.sh"
    exit 1
fi

echo "Database is running. Starting Backend..."
docker-compose -f docker-compose.backend.yml up -d

echo ""
echo "Backend container status:"
docker ps | grep wms_backend

echo ""
echo "To view logs, run:"
echo "  docker-compose -f docker-compose.backend.yml logs -f"
echo ""
echo "To stop backend, run:"
echo "  docker-compose -f docker-compose.backend.yml down"

