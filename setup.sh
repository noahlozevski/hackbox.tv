#!/bin/bash

set -e  # Exit on error

echo "=== hackbox.tv Server Setup ==="
echo ""

# Configuration
DOMAIN="hackbox.tv.lozev.ski"
EMAIL="noahlozevski@gmail.com"
APP_DIR="/home/noahlozevski/app"
STATIC_DIR="/var/www/hackbox_site"
NGINX_CONF="/etc/nginx/sites-available/hackbox"

# Check if running as correct user
if [ "$USER" != "noahlozevski" ]; then
    echo "Warning: This script should be run as user 'noahlozevski'"
    echo "Current user: $USER"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Update system packages
echo "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install prerequisites
echo "Installing prerequisites..."
sudo apt-get install -y curl git software-properties-common nginx certbot python3-certbot-nginx ufw fail2ban

# Install Node.js 18.x if not installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
else
    echo "PM2 already installed"
fi

# Configure UFW firewall
echo "Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000
sudo ufw --force enable

# Enable Fail2Ban
echo "Enabling Fail2Ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Build the application
echo "Building application..."
cd "$APP_DIR"
npm install
npm run build

# Create static files directory
echo "Setting up static files directory..."
sudo mkdir -p "$STATIC_DIR"

# Deploy static files
echo "Deploying static files..."
./deploy_static.sh

# Configure Nginx
echo "Configuring Nginx..."
sudo tee "$NGINX_CONF" > /dev/null <<'EOF'
server {
    listen 80;
    server_name hackbox.tv.lozev.ski;

    # Serve static files
    root /var/www/hackbox_site;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Proxy WebSocket connections to the Node.js backend
    location /ws/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Enable Nginx site
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/

# Test Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# Restart Nginx
echo "Restarting Nginx..."
sudo systemctl restart nginx

# Start application with PM2
echo "Starting application with PM2..."
pm2 delete hackbox-app 2>/dev/null || true
pm2 start "$APP_DIR/dist/server.js" --name hackbox-app
pm2 startup systemd -u noahlozevski --hp /home/noahlozevski
pm2 save

# Set up SSL with Let's Encrypt
echo "Setting up SSL certificate..."
sudo certbot --nginx --non-interactive --agree-tos --redirect --hsts --staple-ocsp --email "$EMAIL" -d "$DOMAIN" || {
    echo "Warning: SSL setup failed. You may need to run certbot manually."
    echo "Command: sudo certbot --nginx -d $DOMAIN"
}

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Application: https://$DOMAIN"
echo "WebSocket: wss://$DOMAIN/ws/"
echo ""
echo "Useful commands:"
echo "  pm2 status          - Check application status"
echo "  pm2 logs hackbox-app - View logs"
echo "  pm2 restart hackbox-app - Restart application"
echo ""
echo "To deploy updates, run: ./deploy.sh"
