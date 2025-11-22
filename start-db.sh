#!/bin/bash

# Script สำหรับรัน Database Container แยก

echo "Starting SQL Server Database..."
docker-compose -f docker-compose.db.yml up -d

echo ""
echo "Waiting for database to be ready..."
sleep 5

echo ""
echo "Database container status:"
docker ps | grep wms_db

echo ""
echo "To view logs, run:"
echo "  docker-compose -f docker-compose.db.yml logs -f"
echo ""
echo "To stop database, run:"
echo "  docker-compose -f docker-compose.db.yml down"

