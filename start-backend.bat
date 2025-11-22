@echo off
REM Script สำหรับรัน Backend Container (Windows)

echo Checking if database is running...
docker ps | findstr wms_db >nul
if errorlevel 1 (
    echo ERROR: Database container (wms_db) is not running!
    echo Please start the database first:
    echo   docker-compose -f docker-compose.db.yml up -d
    echo   or
    echo   start-db.bat
    exit /b 1
)

echo Database is running. Starting Backend...
docker-compose -f docker-compose.backend.yml up -d

echo.
echo Backend container status:
docker ps | findstr wms_backend

echo.
echo To view logs, run:
echo   docker-compose -f docker-compose.backend.yml logs -f
echo.
echo To stop backend, run:
echo   docker-compose -f docker-compose.backend.yml down

