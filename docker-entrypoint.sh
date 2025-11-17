#!/bin/sh
set -e

echo "Waiting for SQL Server and initializing database..."

# Wait for SQL Server and create database using Node.js script
node docker-init-db.js

echo "Database ready - starting application..."

# Start the application
exec "$@"

