# Claude Development Workflow

## Standard Development Process

When implementing features, always follow this workflow:

1. **Develop** - Implement the feature with tests
2. **Test** - Run tests locally to verify functionality
3. **Commit & Push** - Commit changes and push to GitHub (REQUIRED before deploy)
4. **Deploy** - Use this EXACT command (do not use separate ssh/cd/git commands):
   ```bash
   ssh hackbox "cd /home/noahlozevski/app && git pull && ./deploy.sh"
   ```
5. **Verify** - Run end-to-end tests against production to ensure deployment succeeded

## Deployment Notes

- The deployment script (`deploy.sh`) handles: dependencies, build, e2e tests, static file deployment, and PM2 restart
- Always verify the site is working after deployment
- Manual SSH access required for deployment (no automated deployment from local machine)

## Key Principles

- Always test as much as you can before committing
- Ensure lint / typecheck / alll tests pass before committing. e2e tests will need to be ran after deployment.
- Always deploy and verify after pushing changes
- Ensure production remains stable with e2e tests
- e2e tests cannont be tested locally, they must be deployed before testing again
- Follow mobile-first, clean UI design principles
