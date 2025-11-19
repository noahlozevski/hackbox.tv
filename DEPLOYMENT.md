# Deployment Guide - hackbox.tv

## Overview

This document describes how to deploy and maintain the hackbox.tv WebSocket server on your Hetzner server.

**Domain**: hackbox.tv.lozev.ski
**Server**: Hetzner VPS
**Repository**: https://github.com/noahlozevski/hackbox.tv.git

## Architecture

- **Backend**: Node.js/TypeScript WebSocket server (port 3000)
- **Frontend**: Static HTML/CSS/JS served by Nginx
- **Process Manager**: PM2
- **Reverse Proxy**: Nginx with Let's Encrypt SSL
- **Deployment Directory**: `/home/noahlozevski/app`
- **Static Files**: `/var/www/hackbox_site`

## Git Workflow

### Development (Mac)
```bash
# Make changes locally
git add .
git commit -m "Your changes"
git push origin main
```

### Deployment (Server)
```bash
# SSH into the server
ssh noahlozevski@hackbox.tv.lozev.ski

# Pull latest changes
cd /home/noahlozevski/app
git pull origin main

# Deploy updates (see Update/Deploy section below)
./deploy.sh
```

**Note**: Git keys stay on your Mac. The server only needs read access to pull changes.

## Initial Setup

### Prerequisites
- Ubuntu server with SSH access
- Domain pointing to server IP
- SSH key-based authentication configured

### First-Time Setup

Run the setup script on the server:

```bash
# SSH into the server
ssh noahlozevski@hackbox.tv.lozev.ski

# Clone the repository
git clone https://github.com/noahlozevski/hackbox.tv.git app
cd app

# Run the setup script
chmod +x setup.sh
./setup.sh
```

This will:
1. Install Node.js, Nginx, PM2, Certbot
2. Configure firewall (UFW)
3. Build the TypeScript application
4. Deploy static files to `/var/www/hackbox_site`
5. Configure Nginx reverse proxy
6. Set up SSL with Let's Encrypt
7. Start the application with PM2

## Update/Deploy Changes

After pulling changes from git:

```bash
cd /home/noahlozevski/app
./deploy.sh
```

This script:
1. Installs/updates npm dependencies
2. Builds TypeScript → JavaScript
3. Deploys static files to Nginx directory
4. Restarts the PM2 process

## Testing

### Local Test (from your Mac)
```bash
npm run test
```

This curls https://hackbox.tv.lozev.ski/ and verifies it returns HTTP 200.

### Manual Tests
```bash
# Check site is accessible
curl https://hackbox.tv.lozev.ski/

# Check WebSocket endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" https://hackbox.tv.lozev.ski/ws/

# Check PM2 status
pm2 status

# Check Nginx status
sudo systemctl status nginx

# View application logs
pm2 logs hackbox-app
```

## Server Management

### PM2 Commands
```bash
# View status
pm2 status

# View logs
pm2 logs hackbox-app

# Restart application
pm2 restart hackbox-app

# Stop application
pm2 stop hackbox-app

# Start application
pm2 start hackbox-app
```

### Nginx Commands
```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate Renewal
```bash
# Certificates auto-renew via cron
# Manual renewal:
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

## Firewall Configuration

```bash
# View current rules
sudo ufw status

# Required ports:
# - 22 (SSH)
# - 80 (HTTP)
# - 443 (HTTPS)
# - 3000 (WebSocket - direct access)
```

## File Structure

```
/home/noahlozevski/app/          # Application directory
├── src/                         # TypeScript source
├── dist/                        # Compiled JavaScript
├── site/                        # Static frontend files
├── setup.sh                     # Initial setup script
├── deploy.sh                    # Update/deploy script
└── deploy_static.sh             # Static file deployment

/var/www/hackbox_site/           # Nginx static files
├── index.html
├── client.js
├── connect-four.js
└── og_image.jpg

/etc/nginx/sites-available/      # Nginx configuration
└── hackbox
```

## Troubleshooting

### Site not accessible
```bash
# Check Nginx
sudo systemctl status nginx
sudo nginx -t

# Check firewall
sudo ufw status

# Check SSL
sudo certbot certificates
```

### WebSocket connection fails
```bash
# Check PM2 process
pm2 status
pm2 logs hackbox-app

# Check if port 3000 is listening
sudo netstat -tlnp | grep 3000

# Check Nginx proxy configuration
sudo nginx -t
```

### Application crashes
```bash
# View logs
pm2 logs hackbox-app

# Restart
pm2 restart hackbox-app

# Check system resources
htop
df -h
```

## Environment

### No environment variables required
All configuration is in the source code:
- Server port: 3000 (hardcoded in `src/server.ts`)
- WebSocket URL: wss://hackbox.tv.lozev.ski/ws/ (hardcoded in `site/client.js`)
- Rooms: ['Room1', 'Room2', 'Room3'] (hardcoded in `src/server.ts`)

## Security

- SSH: Key-based authentication only
- Firewall: UFW configured (SSH, HTTP, HTTPS, port 3000)
- SSL: Let's Encrypt certificate with auto-renewal
- Updates: Unattended security updates enabled
- Intrusion prevention: Fail2Ban installed

## Complete Server Rebuild

If you need to rebuild the server from scratch, use the cloud-init configuration:

```bash
# On Hetzner, create new server with cloud-init from:
cat src/cloud-init
```

This provides a fully automated server provisioning with all dependencies and configuration.
