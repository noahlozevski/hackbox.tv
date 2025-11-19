#!/bin/bash

set -e  # Exit on error

echo "=== Deploying hackbox.tv Updates ==="
echo ""

APP_DIR="/home/noahlozevski/app"

# Ensure we're in the app directory
cd "$APP_DIR"

# Install/update dependencies
echo "Installing dependencies..."
npm install

# Build TypeScript
echo "Building application..."
npm run build

# Run end-to-end connection check against production WebSocket
echo "Running end-to-end connection test..."
npm run test:e2e

# Deploy static files
echo "Deploying static files..."
./deploy_static.sh

# Restart PM2 process
echo "Restarting application..."
pm2 restart hackbox-app

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Application restarted successfully!"
echo ""
echo "Check status: pm2 status"
echo "View logs: pm2 logs hackbox-app"
