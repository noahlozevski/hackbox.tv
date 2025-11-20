#!/bin/bash

set -e  # Exit on error

echo "=== Deploying hackbox.tv Updates ==="
echo ""

APP_DIR="/home/noahlozevski/app"

# Ensure we're in the app directory
cd "$APP_DIR"

# Kill any stray node processes that might be running old code
echo "Cleaning up old processes..."
pkill -f "node.*dist/server.js" || true
sleep 2

# Install/update dependencies for the main app
echo "Installing root dependencies..."
npm install

# Install/update dependencies and build the Next.js web app
if [ -d "web" ]; then
  echo "Installing web/ dependencies..."
  cd web
  npm install
  echo "Building Next.js app..."
  npm run build
  cd "$APP_DIR"
fi

# Clean previous builds to ensure fresh compile
echo "Cleaning previous builds..."
rm -rf dist site-dist

# Build TypeScript (server and client)
echo "Building application..."
npm run build

# Verify the build output exists
if [ ! -f "dist/src/server.js" ]; then
  echo "ERROR: Server build failed - dist/src/server.js not found"
  exit 1
fi

if [ ! -d "site/dist/site/src" ]; then
  echo "ERROR: Client build failed - site/dist/site/src not found"
  exit 1
fi

# Run end-to-end connection check against production WebSocket
echo "Running end-to-end connection test..."
npm run test:e2e || echo "Warning: E2E tests failed, but continuing deployment..."

# Deploy static files
echo "Deploying static files..."
./deploy_static.sh

# Stop PM2 app completely, then start it fresh (not restart)
echo "Stopping application..."
pm2 stop hackbox-app || true

echo "Starting WebSocket application (hackbox-app)..."
pm2 start dist/src/server.js --name hackbox-app || pm2 restart hackbox-app

# Start or restart the Next.js frontend (hackbox-web) on port 3002
if pm2 describe hackbox-web > /dev/null 2>&1; then
  echo "Restarting Next.js application (hackbox-web)..."
  pm2 restart hackbox-web
else
  echo "Starting Next.js application (hackbox-web)..."
  PORT=3002 pm2 start npm --name hackbox-web --cwd "$APP_DIR/web" -- start
fi

# Save PM2 configuration
pm2 save

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Application restarted successfully!"
echo ""
echo "Check status: pm2 status"
echo "View logs: pm2 logs hackbox-app"
