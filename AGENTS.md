# AI Agent Guidelines

## Development Workflow

AI agents working on this project should follow this standard workflow for all feature development:

1. **Develop** - Implement features with appropriate tests
2. **Test** - Run local tests to verify functionality
3. **Commit & Push** - Create descriptive commit and push to GitHub
4. **Deploy** - Guide user to deploy via SSH (automated deployment not available)
5. **Verify** - Confirm deployment success with e2e tests

## Deployment Process

Deployment requires manual SSH access:

```bash
ssh hackbox "cd /home/noahlozevski/app && git pull && ./deploy.sh"
```

The `deploy.sh` script automates: dependency installation, TypeScript build, e2e testing, static file deployment, and PM2 process restart.

## Key Principles

- Always test as much as you can before committing
- Ensure lint / typecheck / alll tests pass before committing. e2e tests will need to be ran after deployment.
- Always deploy and verify after pushing changes
- Ensure production remains stable with e2e tests
- e2e tests cannont be tested locally, they must be deployed before testing again
- Follow mobile-first, clean UI design principles
