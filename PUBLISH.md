# Publishing Guide

This document describes how to publish the R Best Practices MCP Server to npm and Docker registries.

## Table of Contents

- [npm Registry](#npm-registry)
- [Docker Hub/GitHub Packages](#docker-hubgithub-packages)
- [Release Process](#release-process)
- [Versioning](#versioning)

## npm Registry

### Prerequisites

1. **npm account** - Create one at [npmjs.com](https://npmjs.com) if you don't have one
2. **Authentication** - Run `npm login` to authenticate:
   ```bash
   npm login
   # Enter username, password, email, and OTP (if 2FA enabled)
   ```
3. **Permissions** - You must be the package owner or have publishing rights

### Manual Publishing

To publish a new version manually:

```bash
# 1. Update version in package.json
npm version patch|minor|major

# 2. This will:
#    - Update package.json version
#    - Update package-lock.json
#    - Create a git commit with the version tag
#    - Create a git tag (e.g., v1.0.1)

# 3. Push the commit and tag
git push origin main --follow-tags

# 4. Publish to npm
npm publish

# Or publish with a tag
npm publish --tag beta  # For pre-releases
```

### Automated Publishing

Publishing is automated via GitHub Actions when you push a version tag:

1. Push a version tag to main branch:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

2. The `.github/workflows/publish.yml` workflow will:
   - Run tests and linting
   - Build the package
   - Publish to npm
   - Publish Docker image
   - Create a GitHub release

## Docker Hub/GitHub Packages

### Prerequisites

#### Docker Hub

1. **Docker Hub account** - Create one at [hub.docker.com](https://hub.docker.com)
2. **Repository** - Create a public repository (e.g., `yourusername/r-best-practices-mcp`)
3. **GitHub Secrets** - Add to your repository:
   - `DOCKERHUB_USERNAME` - Your Docker Hub username
   - `DOCKERHUB_TOKEN` - Your Docker Hub access token ([create here](https://hub.docker.com/settings/security))

#### GitHub Packages

GitHub Packages uses your GitHub credentials automatically. No additional setup needed.

### Manual Docker Publishing

```bash
# 1. Build the image
docker build -t r-best-practices-mcp:1.0.0 .

# 2. Tag for Docker Hub
docker tag r-best-practices-mcp:1.0.0 yourusername/r-best-practices-mcp:1.0.0
docker tag r-best-practices-mcp:1.0.0 yourusername/r-best-practices-mcp:latest

# 3. Push to Docker Hub
docker login
docker push yourusername/r-best-practices-mcp:1.0.0
docker push yourusername/r-best-practices-mcp:latest

# 4. Tag for GitHub Packages
docker tag r-best-practices-mcp:1.0.0 ghcr.io/yourusername/r-best-practices-mcp:1.0.0
docker tag r-best-practices-mcp:1.0.0 ghcr.io/yourusername/r-best-practices-mcp:latest

# 5. Push to GitHub Packages
docker login ghcr.io -u yourusername -p $GITHUB_TOKEN
docker push ghcr.io/yourusername/r-best-practices-mcp:1.0.0
docker push ghcr.io/yourusername/r-best-practices-mcp:latest
```

### Automated Docker Publishing

When you push a version tag, the `.github/workflows/publish.yml` workflow automatically:

1. Builds the Docker image
2. Tags with semantic version (e.g., `v1.0.0` → `1.0.0`)
3. Tags with `latest` for latest version
4. Pushes to both Docker Hub and GitHub Packages

## Release Process

### Step-by-Step Release

1. **Update version** in `package.json` and ensure `CHANGELOG.md` is up to date

   ```bash
   # Using npm version command (recommended)
   npm version major|minor|patch
   ```

   Or manually:
   ```bash
   # Edit package.json, then:
   git commit -am "chore: bump version to 1.0.1"
   git tag v1.0.1
   ```

2. **Run tests and checks locally**

   ```bash
   npm run test
   npm run lint
   npm run build
   ```

3. **Push to main branch**

   ```bash
   git push origin main --follow-tags
   ```

   Or if you created the tag manually:
   ```bash
   git push origin main
   git push origin v1.0.1
   ```

4. **Monitor the workflow**

   - Go to [GitHub Actions](https://github.com/yourusername/r-coding-mcp/actions)
   - Watch the `publish.yml` workflow
   - It will:
     - Build and test
     - Publish to npm
     - Build and push Docker images
     - Create a GitHub release

5. **Verify the release**

   - Check [npm package page](https://www.npmjs.com/package/r-best-practices-mcp)
   - Check [Docker Hub repository](https://hub.docker.com/r/yourusername/r-best-practices-mcp)
   - Check [GitHub Releases](https://github.com/yourusername/r-coding-mcp/releases)

### Pre-release Publishing

For beta or alpha versions:

```bash
# Using npm
npm version prerelease --preid=beta

# Or manually
npm publish --tag beta

# Then version command will show: 1.0.0-beta.0
```

## Versioning

See [docs/versioning.md](docs/versioning.md) for detailed versioning strategy.

### Quick Reference

- **MAJOR** (1.0.0) - Breaking API changes
- **MINOR** (1.1.0) - New features, backwards compatible
- **PATCH** (1.0.1) - Bug fixes, backwards compatible

Example:
```bash
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.1 → 1.1.0
npm version major  # 1.1.0 → 2.0.0
```

## Troubleshooting

### npm publish fails

**"You must be logged in"**
```bash
npm logout
npm login
npm publish
```

**"Package name not available"**
- Check if another package has this name
- Consider using a scoped package: `@yourusername/r-best-practices-mcp`

### Docker push fails

**"Authentication error"**
```bash
docker logout
docker login
# Then re-authenticate with credentials
```

**"Repository not found"**
- Ensure the repository exists on Docker Hub
- Create it manually if needed

### Workflow fails

1. Check the workflow logs in GitHub Actions
2. Verify secrets are set:
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`
   - `NPM_TOKEN` (if using npm publish in workflow)

3. Check git tags:
   ```bash
   git tag -l  # List all tags
   git tag -d v1.0.0  # Delete local tag if needed
   git push origin :v1.0.0  # Delete remote tag if needed
   ```

## Related Documents

- [DOCKER.md](DOCKER.md) - Docker image documentation
- [docs/versioning.md](docs/versioning.md) - Versioning strategy
- [.npmrc](.npmrc) - npm configuration
- [.github/workflows/publish.yml](.github/workflows/publish.yml) - Release automation workflow
