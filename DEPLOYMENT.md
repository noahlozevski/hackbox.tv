# Deployment Guide - hackbox.tv

## Overview

Quick reference for deploying hackbox.tv to production.

**Repository**: https://github.com/noahlozevski/hackbox.tv.git

## Game Development Philosophy

All games on hackbox.tv follow these core principles:

1. **Mobile-First**: Games must work perfectly on phones with touch controls
2. **Single-File Games**: Each game should be self-contained in one TypeScript file (`site/src/game-name.ts`)
3. **Simple & Fast**: Games should be lightweight, load quickly, and have minimal dependencies
4. **Responsive UI**: All UI elements must scale properly on different screen sizes
5. **Touch-Optimized**: On-screen controls for mobile, keyboard support for desktop
6. **Self-Contained Styling**: All game-specific CSS should be injected via the game's own code
7. **Clean Lifecycle**: Implement proper `start()` and `stop()` methods that clean up all resources

**Post-Deploy Mobile Check**: After any deployment, quickly load the site on an actual phone to verify touch controls render and respond correctly.

## Deployment Workflow

### ⚠️ CRITICAL: Only Deploy Working Code

**NEVER deploy untested or broken code to production.**

Before deploying:
1. ✅ Run `npm run build` locally and ensure it passes
2. ✅ Test the changes locally with `npm run dev`
3. ✅ Verify all features work as expected
4. ✅ Commit and push to git

### Local Deployment (Recommended)

Use the local deployment script to deploy from your development machine:

```bash
# After pushing to git
./deploy-local.sh
```

This script handles:
- SSHing to the server
- Pulling latest changes
- Running the deployment process
- Restarting the application

### Manual Deployment

If `deploy-local.sh` is not available, deploy manually:

```bash
ssh <server> "cd <app-directory> && git pull && ./deploy.sh"
```

## Architecture Overview

- **Backend**: Node.js/TypeScript WebSocket server (`src/server.ts`)
- **Frontend**: Next.js app in `web/` plus a compiled static bundle under `/var/www/hackbox_site` for the client/game scripts
- **Share Pages**: Implemented as Next.js route handlers at `/share/:room` and `/share/:room/:game`, using `buildSharePageHtml` for OG/Twitter metadata
- **Build System**: TypeScript compiler for the backend/client (`npm run build`) and Next.js for the web app (`cd web && npm run build`)
- **Process Manager**: PM2
- **Deployment Script**: `./deploy.sh` on the server handles builds and restarts both the WebSocket server and the Next.js app

The `deploy.sh` script on the server typically:
1. Installs/updates root dependencies
2. Installs/updates `web/` dependencies and builds the Next.js app
3. Builds TypeScript → JavaScript for the backend and client
4. Deploys static files
5. Restarts the WebSocket server (`hackbox-app`) and Next.js app (`hackbox-web`) under PM2

## Testing After Deployment

### Verify Deployment
```bash
# Run the automated checks locally
npm run lint
npm test

# From the server (run inside the app directory)
npm run test:e2e
```

This will validate:
- WebSocket connectivity against production (`src/connection.e2e.test.ts`)
- Room/game-specific Open Graph share pages served from production (`src/share-page.e2e.test.ts`)

### Quick Mobile Test
After deployment, open the site on an actual phone to verify:
- Touch controls work
- Canvas/UI scales properly
- Games are playable

## Common Server Commands

If you need to troubleshoot on the server:

```bash
# View application status
pm2 status

# View application logs
pm2 logs

# Restart the application
pm2 restart <app-name>

# Check web server status
sudo systemctl status nginx
```

### Nginx (Reference)

The production Nginx config for `hackbox.tv.lozev.ski`:

```nginx
location /ws/ {
    proxy_pass http://localhost:3000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

location / {
    try_files $uri @next;
}

location @next {
    proxy_pass http://localhost:3002;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Static assets are still served directly from `/var/www/hackbox_site`, and all other HTTP traffic (including `/share/`) is handled by the Next.js app.

### Environment Variables

- `HACKBOX_PUBLIC_ORIGIN` (server-side, optional): Controls the absolute origin used when generating share pages. Defaults to `https://hackbox.tv.lozev.ski`.
- `HACKBOX_SHARE_E2E_ORIGIN`, `HACKBOX_SHARE_E2E_ROOM`, `HACKBOX_SHARE_E2E_GAME` (optional): Used only by `src/share-page.e2e.test.ts` to override the default production URL under test, if needed.

---

**For detailed server setup, configuration, and troubleshooting, refer to the server's internal documentation or setup scripts.**
