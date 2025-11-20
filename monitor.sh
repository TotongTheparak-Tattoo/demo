#!/bin/bash

echo "=== Docker Container Stats ==="
docker stats --no-stream

echo ""
echo "=== Container Status ==="
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "=== Backend Container Resource Usage ==="
docker stats wms_backend --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"

echo ""
echo "=== Database Container Resource Usage ==="
docker stats wms_db --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"

echo ""
echo "=== Redis Container Resource Usage ==="
docker stats wms_redis --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"

echo ""
echo "=== Backend Logs (Last 20 lines) ==="
docker-compose -f docker-compose.prod.yml logs --tail=20 backend

echo ""
echo "=== Disk Usage ==="
df -h

echo ""
echo "=== Docker Disk Usage ==="
docker system df

