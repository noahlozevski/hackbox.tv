#!/bin/bash

# Deploy static files to web server
# Client build outputs to site/dist/site/* due to TypeScript rootDir config

APP_DIR="/home/noahlozevski/app"
WEB_DIR="/var/www/hackbox_site"

# Clear existing files to avoid stale code
echo "Clearing old static files..."
sudo rm -rf "$WEB_DIR"/*

# Copy built client files
echo "Copying built client files..."
sudo cp -R "$APP_DIR/site/dist/site/"* "$WEB_DIR/"

# Copy any static HTML/CSS files from site root if they exist
if [ -f "$APP_DIR/site/index.html" ]; then
  sudo cp "$APP_DIR/site/"*.html "$WEB_DIR/" 2>/dev/null || true
fi

if [ -f "$APP_DIR/site/style.css" ]; then
  sudo cp "$APP_DIR/site/"*.css "$WEB_DIR/" 2>/dev/null || true
fi

# Set permissions
sudo chown -R www-data:www-data "$WEB_DIR"
sudo chmod -R 755 "$WEB_DIR"

echo "Static files deployed successfully"

