# CI/CD Pipeline Setup Guide

This document describes the GitHub Actions CI/CD pipeline for the R Best Practices MCP project and how to configure branch protection rules.

## Overview

The CI/CD pipeline includes:

1. **Test Workflow** (`test.yml`) — Linting, building, unit tests, coverage reporting
2. **Docker Workflow** (`docker.yml`) — Docker image building and security scanning
3. **Release Workflow** (`release.yml`) — Automated releases on git tags with artifacts
4. **Branch Protection Rules** — Enforce quality standards on main/develop branches

## Workflows

### Test Workflow (.github/workflows/test.yml)

Runs on every push and pull request to enforce code quality standards.

**Triggers:**
- Push to main, develop, or feature branches
- Pull requests to main or develop

**Jobs:**

#### 1. Lint, Build & Test
- **Node.js version:** 20.x
- **Steps:**
  - Install dependencies
  - Lint code with ESLint
  - Build TypeScript
  - Run unit tests with Jest
  - Generate coverage reports
  - Upload to Codecov
  - Check coverage threshold (80%)

**Requirements:**
- All lint checks must pass
- Build must succeed
- Tests must pass with >80% coverage

#### 2. Type Check
- Runs TypeScript type checker with strict mode
- Ensures no type errors

#### 3. Test Matrix
- Tests on multiple Node.js versions (18.x, 20.x)
- Ensures compatibility across versions

### Docker Workflow (.github/workflows/docker.yml)

Builds and tests Docker images on push and PR.

**Triggers:**
- Push to main, develop, or feature branches
- Pull requests

**Jobs:**

#### 1. Build Docker Image
- Builds Docker image using Buildx
- Uses layer caching for faster builds
- Tests image health endpoint
- Verifies all builds are functional

#### 2. Security Scan
- Runs Trivy vulnerability scan
- Scans for CRITICAL and HIGH severity issues
- Uploads results to GitHub Security tab
- Does not block deployment (advisory only)

#### 3. Docker Compose Test
- Tests multi-container setup with docker-compose
- Verifies all services start correctly
- Checks health endpoints

### Release Workflow (.github/workflows/release.yml)

Automatically creates releases when you push git tags matching `v*.*.*`

**Triggers:**
- Push with tag matching pattern `v*.*.*` (e.g., `v1.2.3`)

**Jobs:**

#### 1. Build Release Artifacts
- Installs dependencies
- Runs full test suite
- Builds TypeScript
- Creates tar.gz and ZIP archives
- Uploads as workflow artifacts

#### 2. Generate Changelog
- Extracts commit messages since last tag
- Generates formatted changelog
- Supports initial release (no previous tag)

#### 3. Create GitHub Release
- Generates comprehensive release notes
- Downloads artifacts
- Creates GitHub Release with artifacts attached
- Handles pre-releases (alpha, beta, rc tags)

#### 4. Docker Image Tagging
- Builds Docker image with version tag
- Tags as latest
- Tests the image
- Displays push instructions

## Usage

### Running Tests Locally

Before pushing, run tests locally:

```bash
# Install dependencies
npm install

# Run all tests with coverage
npm test

# Run linting
npm run lint

# Build TypeScript
npm run build

# Build Docker image
docker build -t r-best-practices-mcp:test .

# Run Docker image
docker-compose up
```

### Creating a Release

Create a release by pushing a git tag:

```bash
# Ensure your main/develop branch is up to date
git checkout main
git pull origin main

# Create a version tag
git tag v1.2.3

# Push the tag to trigger the release workflow
git push origin v1.2.3
```

The workflow will:
1. Run full test suite
2. Build artifacts
3. Create GitHub Release with changelog
4. Build and tag Docker image

**Tag Format:** Must match `v*.*.*` (e.g., v1.0.0, v2.1.3-beta)

### Pre-releases

For alpha, beta, or rc versions, use:

```bash
git tag v1.2.3-alpha
git tag v1.2.3-beta
git tag v1.2.3-rc
git push origin v1.2.3-alpha
```

These will be marked as pre-releases on GitHub.

## Branch Protection Rules

Branch protection rules enforce code quality before code can be merged. Configure these for the main and develop branches.

### Configuration Steps

1. Go to **Settings** → **Branches**
2. Click **Add rule** under "Branch protection rules"
3. Configure for each branch:

#### For `main` branch:

**Branch name pattern:** `main`

**Protect matching branches:**
- [x] Require a pull request before merging
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require code review approvals
    - Required number of approvals: 1
  - [x] Require approval of the most recent reviewable push
- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Status checks that must pass:
    - `test / Lint, Build & Test`
    - `test / Type Check`
    - `docker / Build Docker Image`
    - `docker / Security Scan`
- [x] Require conversation resolution before merging
- [x] Include administrators in restrictions
- [x] Dismiss invalid reviews automatically
- [x] Require a merge commit
- Allow auto-merge: Disabled (manual merge only)

#### For `develop` branch:

**Branch name pattern:** `develop`

**Protect matching branches:**
- [x] Require a pull request before merging
  - [x] Require code review approvals
    - Required number of approvals: 1
  - [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
  - Status checks that must pass:
    - `test / Lint, Build & Test`
    - `test / Type Check`
    - `docker / Build Docker Image`
- [x] Require conversation resolution before merging
- Allow auto-merge: Optional (with "auto-merge commits")

### Recommended Settings for Feature Branches

For feature branches (optional but recommended):

**Branch name pattern:** `feature/*`, `fix/*`, `refactor/*`

**Protect matching branches:**
- [x] Require a pull request before merging
  - [x] Require code review approvals (1 approval)
- [x] Require status checks to pass before merging
  - Status checks:
    - `test / Lint, Build & Test`

## Status Checks

The following status checks must pass for PRs to be merged:

| Check | Purpose | Required |
|-------|---------|----------|
| `test / Lint, Build & Test` | ESLint, build, tests, coverage | Yes |
| `test / Type Check` | TypeScript type safety | Yes |
| `test / Test Matrix` | Compatibility testing | No (informational) |
| `docker / Build Docker Image` | Docker build validation | Yes |
| `docker / Security Scan` | Vulnerability scanning | No (advisory) |
| `docker / Compose Test` | Multi-container testing | No (informational) |

## Coverage Thresholds

The test workflow checks that code coverage meets the following thresholds:

- **Line coverage:** ≥ 80%
- **Statement coverage:** ≥ 80%
- **Branch coverage:** ≥ 80%
- **Function coverage:** ≥ 80%

Coverage reports are uploaded to Codecov for tracking over time.

## Security Scanning

The Docker workflow performs security scanning using Trivy:

- **Severity levels scanned:** CRITICAL, HIGH
- **Results uploaded to:** GitHub Security tab
- **Blocks deployment:** No (advisory only)

To enable blocking on critical vulnerabilities, update the Trivy action in `docker.yml`:

```yaml
- name: Run Trivy vulnerability scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'r-best-practices-mcp:scan'
    format: 'sarif'
    output: 'trivy-results.sarif'
    exit-code: '1'  # Add this to block on findings
```

## Performance & Caching

All workflows use GitHub Actions caching to speed up builds:

- **NPM dependencies:** Cached in node_modules
- **Docker layers:** Cached using buildx cache
- **TypeScript:** Build cache enabled

First run: ~2 minutes
Subsequent runs: ~1 minute (with cache hits)

## Troubleshooting

### Tests Failing Locally But Passing in CI

1. Update npm: `npm install -g npm@latest`
2. Clean install: `rm -rf node_modules && npm ci`
3. Clear Jest cache: `npm test -- --clearCache`
4. Check Node.js version: `node --version` (should be ≥20.0.0)

### Docker Build Failing

1. Check Dockerfile syntax: `docker build .`
2. Verify dependencies: `npm ci --only=production`
3. Check Node.js version in Dockerfile (currently 20-alpine)

### Release Not Triggering

1. Verify tag format: Must match `v*.*.*` (e.g., `v1.2.3`)
2. Push tag explicitly: `git push origin v1.2.3`
3. Check tag was created: `git tag -l`

### Workflow Files Not Found

1. Ensure .github/workflows/ directory exists
2. Verify file names are correct (*.yml or *.yaml)
3. Check YAML syntax with linter

## Monitoring

### View Workflow Runs

- **Dashboard:** GitHub repository → Actions tab
- **Per-workflow:** Click workflow name on Actions tab
- **Real-time output:** Click job to see logs

### Enable Notifications

- **Email:** Settings → Notifications → Check "Actions"
- **Slack:** Add GitHub Slack app to workspace
- **Custom webhooks:** Settings → Webhooks

## Cost Considerations

GitHub Actions provides free minutes for public repositories:
- 2,000 minutes/month for private repos (with paid plan)
- Unlimited for public repos

Current pipeline uses approximately:
- Test workflow: ~1-2 minutes per run
- Docker workflow: ~2-3 minutes per run
- Release workflow: ~3-4 minutes per run

Approximately 50-100 minutes/month for typical usage.

## Next Steps

1. Merge this CICD_SETUP.md to main branch
2. Configure branch protection rules on GitHub
3. Test workflow by creating a PR
4. Once validated, create first release with `git tag v1.0.0`
5. Monitor workflow runs in Actions tab

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Jest Coverage](https://jestjs.io/docs/coverage)
- [ESLint Configuration](https://eslint.org/docs/rules/)
