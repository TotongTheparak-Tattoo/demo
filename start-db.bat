@echo off
REM Script สำหรับรัน Database Container แยก (Windows)

echo Starting SQL Server Database...
docker-compose -f docker-compose.db.yml up -d

echo.
echo Waiting for database to be ready...
timeout /t 5 /nobreak >nul

echo.
echo Database container status:
docker ps | findstr wms_db

echo.
echo To view logs, run:
echo   docker-compose -f docker-compose.db.yml logs -f
echo.
echo To stop database, run:
echo   docker-compose -f docker-compose.db.yml down

