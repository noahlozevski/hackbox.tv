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

- **Backend**: Node.js/TypeScript WebSocket server
- **Frontend**: Static HTML/CSS/JS
- **Share Pages**: Lightweight Node HTTP server that renders room/game-specific Open Graph and Twitter metadata at `/share/:room/:game?`
- **Build System**: TypeScript compiler (`npm run build`)
- **Process Manager**: PM2 (or similar)
- **Deployment Script**: `./deploy.sh` on the server handles build and restart

The `deploy.sh` script on the server typically:
1. Installs/updates dependencies
2. Builds TypeScript → JavaScript
3. Deploys static files
4. Restarts the application

The share-page HTTP server is started from the same Node process as the WebSocket server (see `src/server.ts`) and listens on port `3001`. Nginx proxies `/share/` requests to this port.

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

### Nginx Share Route (Reference)

The production Nginx config for `hackbox.tv.lozev.ski` includes:

```nginx
location /share/ {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
}
```

This forwards `/share/:room/:game?` URLs to the Node share-page server so social crawlers (Twitter/X, iMessage, etc.) see room/game-specific OG/Twitter tags.

### Environment Variables

- `HACKBOX_PUBLIC_ORIGIN` (server-side, optional): Controls the absolute origin used when generating share pages. Defaults to `https://hackbox.tv.lozev.ski`.
- `HACKBOX_SHARE_E2E_ORIGIN`, `HACKBOX_SHARE_E2E_ROOM`, `HACKBOX_SHARE_E2E_GAME` (optional): Used only by `src/share-page.e2e.test.ts` to override the default production URL under test, if needed.

---

**For detailed server setup, configuration, and troubleshooting, refer to the server's internal documentation or setup scripts.**
