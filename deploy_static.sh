#!/bin/bash

# Deploy static files to web server
# Client build outputs to site/dist/site/* due to TypeScript rootDir config

APP_DIR="/home/noahlozevski/app"
WEB_DIR="/var/www/hackbox_site"

# Clear existing files to avoid stale code
echo "Clearing old static files..."
sudo rm -rf "$WEB_DIR"/*

# Copy built client files to web root
echo "Copying built client files..."
sudo cp -R "$APP_DIR/site/dist/site/"* "$WEB_DIR/"

# Copy shared directory (built separately by TypeScript)
if [ -d "$APP_DIR/site/dist/shared" ]; then
  echo "Copying shared files..."
  sudo cp -R "$APP_DIR/site/dist/shared" "$WEB_DIR/"
fi

# Copy any static HTML/CSS/image/text files from site root if they exist
if [ -f "$APP_DIR/site/index.html" ]; then
  sudo cp "$APP_DIR/site/"*.html "$WEB_DIR/" 2>/dev/null || true
fi

if [ -f "$APP_DIR/site/style.css" ]; then
  sudo cp "$APP_DIR/site/"*.css "$WEB_DIR/" 2>/dev/null || true
fi

for ext in jpg jpeg png webp gif svg ico; do
  if compgen -G "$APP_DIR/site/*.$ext" > /dev/null 2>&1; then
    sudo cp "$APP_DIR/site/"*.$ext "$WEB_DIR/" 2>/dev/null || true
  fi
done

for extra in robots.txt sitemap.xml; do
  if [ -f "$APP_DIR/site/$extra" ]; then
    sudo cp "$APP_DIR/site/$extra" "$WEB_DIR/" 2>/dev/null || true
  fi
done

# Set permissions
sudo chown -R www-data:www-data "$WEB_DIR"
sudo chmod -R 755 "$WEB_DIR"

echo "Static files deployed successfully"
