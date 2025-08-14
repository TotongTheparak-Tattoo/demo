#!/bin/bash

# Run Alembic migrations
alembic upgrade head

# Create output log folder (handle if it already exists)
mkdir -p /output/planing_script

# Start the FastAPI application
exec uvicorn main:app --host 0.0.0.0 --port 8000