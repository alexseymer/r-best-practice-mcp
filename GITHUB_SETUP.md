# GitHub Repository Configuration Guide

This document describes the GitHub repository setup for the R Best Practices MCP project, including branch protection rules, required status checks, and automation configuration.

## Table of Contents

1. [Branch Protection Rules](#branch-protection-rules)
2. [Required Status Checks](#required-status-checks)
3. [Pull Request Settings](#pull-request-settings)
4. [Secrets and Configuration](#secrets-and-configuration)
5. [Troubleshooting](#troubleshooting)

## Branch Protection Rules

### Purpose

Branch protection rules enforce code quality and review standards on the main branch, ensuring that all changes are properly tested and reviewed before merging.

### Main Branch Protection Settings

The following settings should be enabled for the `main` branch:

| Setting | Value | Purpose |
|---------|-------|---------|
| Require pull request reviews before merging | 1 approval | Ensures code review |
| Require status checks to pass | All (see below) | Ensures all tests/checks pass |
| Dismiss stale pull request approvals | Enabled | Ensures reviews are based on latest code |
| Require branches to be up to date | Enabled | Ensures branch is synced with main |
| Include administrators in restrictions | Enabled | Applies rules to everyone |
| Require commit signatures | Optional | Enhanced security if needed |
| Require linear history | Optional | Clean Git history |

### How to Enable Branch Protection

**Via GitHub Web Interface:**

1. Navigate to your repository settings
2. Go to **Settings** → **Branches**
3. Under "Branch protection rules," click **Add rule**
4. Enter `main` as the branch name pattern
5. Check the following boxes:
   - ✅ Require a pull request before merging
   - ✅ Require approvals (set to 1)
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators
6. Under "Require status checks to pass before merging," add the following checks:
   - `test` (from test.yml workflow)
   - `docker` (from docker.yml workflow)
   - `release` (from release.yml workflow)
7. Click **Create** to save the rule

**Important:** The status check names must match exactly the job IDs in the GitHub Actions workflows.

### Development Branch Strategy

For development work, use the `claude/development-assistance-*` branch (or branches named `feature/*`, `fix/*`, etc.):
- No branch protection rules
- Can be force-pushed for rebasing/cleanup
- Must go through PR process to merge to `main`

## Required Status Checks

### GitHub Actions Workflows

The repository uses GitHub Actions for continuous integration. All the following must pass before merging to main:

#### 1. Test Workflow (`.github/workflows/test.yml`)
- **Job ID:** `test`
- **Purpose:** Run unit tests and check code coverage
- **Requirements:**
  - Node.js 20+
  - npm 10+
  - All Jest tests pass
  - Code coverage meets thresholds (70%)
- **On:** Push to main, Pull requests, on schedule

#### 2. Docker Workflow (`.github/workflows/docker.yml`)
- **Job ID:** `docker`
- **Purpose:** Build and verify Docker image
- **Requirements:**
  - Dockerfile builds successfully
  - Image layers are cached appropriately
  - Image tags are correct
- **On:** Push to main, Pull requests

#### 3. Release Workflow (`.github/workflows/release.yml`)
- **Job ID:** `release`
- **Purpose:** Verify release process readiness
- **Requirements:**
  - Version numbers are valid
  - Changelog is updated
  - Package.json is consistent
  - Assets are prepared (builds, archives)
- **On:** Push to main (for releases), Manual workflow dispatch

#### 4. Publish Workflow (`.github/workflows/publish.yml`)
- **Purpose:** Publish to npm and Docker registries (runs after release)
- **Requires:** npm and Docker credentials
- **On:** Release creation

### Status Check Matrix

| Workflow | Trigger | Required for Main | Notes |
|----------|---------|-------------------|-------|
| test.yml | push, PR | Yes | Runs on every change |
| docker.yml | push, PR | Yes | Verifies Docker build |
| release.yml | manual, schedule | Yes | Ensures release readiness |
| publish.yml | release | No* | Only runs for releases |

*Publish only runs after a release is created, so it's not in the protection rules but should pass if release passes.

### Checking Status Checks

**On Pull Requests:**
- GitHub automatically runs all enabled workflows
- Status appears as green checkmark (pass) or red X (fail)
- Cannot merge until all required checks pass (if branch protection is enabled)

**Locally (before pushing):**
```bash
# Run all tests
npm test

# Build the project
npm run build

# Run linter
npm run lint
```

## Pull Request Settings

### PR Templates

The repository includes a pull request template (`.github/pull_request_template.md`) that provides:

- Clear sections for description, type of change, testing
- Checklist of items to verify before submitting
- Links to contributing guidelines
- Reminder to run tests locally

### Auto-Merge (Optional)

Auto-merge can be enabled to automatically merge a PR when all required checks pass and approvals are met.

**To enable auto-merge on a PR:**
1. Go to the PR page
2. Look for "Auto-merge" button at the bottom
3. Select merge strategy (Squash, Merge, Rebase)
4. PR will merge automatically once requirements are met

### Suggested Merge Settings

- **Default strategy:** Squash and merge (keeps history clean)
- **Auto-delete head branches:** Enabled (cleans up feature branches)
- **Require branches to be up to date:** Enabled (prevents stale merges)

## Secrets and Configuration

### Repository Secrets

Required secrets for publishing and deployment:

#### NPM Publishing (`.github/workflows/publish.yml`)
```
NPM_TOKEN         # npm personal access token
  Scope: publish:automation (write-access)
  Created: https://www.npmjs.com/settings/YOUR_USER/tokens
```

#### Docker Registry (`.github/workflows/publish.yml`)
```
DOCKER_USERNAME   # Docker Hub username
DOCKER_PASSWORD   # Docker Hub personal access token
  Created: https://hub.docker.com/settings/security
```

#### GitHub Actions (built-in)
```
GITHUB_TOKEN      # Automatically available, no setup needed
```

### Configuring Secrets

**Via GitHub Web Interface:**

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Enter the secret name (e.g., `NPM_TOKEN`)
4. Paste the secret value
5. Click **Add secret**

**Important Security Notes:**
- Never commit secrets to the repository
- Use environment-scoped secrets when possible
- Rotate tokens regularly
- Review secret usage in workflows

## Automation Configuration

### Issue Labels

Auto-configured labels help organize issues:

- `bug` — Bug reports
- `enhancement` — Feature requests
- `documentation` — Documentation issues
- `help wanted` — Good issues for contributors
- `wontfix` — Will not be fixed
- `duplicate` — Duplicate issue

### Code Owners

Optional: Configure code owners in `.github/CODEOWNERS`:

```
# This file identifies code owners for automatic PR assignments

# Default owners for everything
* @owner-username

# TypeScript/Engine
/src/engine/** @owner-username
/tests/unit/** @owner-username

# Documentation
/docs/** @owner-username
*.md @owner-username
```

### Branch Naming Convention

Recommended branch naming for clarity:

- `feature/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation changes
- `test/description` — Test additions
- `refactor/description` — Code refactoring
- `perf/description` — Performance improvements

## Troubleshooting

### Common Issues

#### Status Check Not Appearing

**Problem:** A required status check doesn't appear on PRs.

**Solutions:**
1. Verify the workflow file is in `.github/workflows/` and valid YAML
2. Check that the job ID matches the required check name exactly
3. Confirm the workflow has the correct trigger (`on: pull_request`)
4. Re-run the workflow if it hasn't run yet

#### Status Check Failing

**Problem:** A status check keeps failing on PRs.

**Common Causes:**
- Tests failing locally: Run `npm test` locally to debug
- Build errors: Run `npm run build` to check TypeScript errors
- Coverage below threshold: Add tests to bring coverage above 70%
- Docker build issues: Run `docker build -f Dockerfile .` locally

**Debugging:**
1. Check the workflow's detailed output on GitHub Actions
2. Look at the error logs from the failing job
3. Reproduce the failure locally
4. Fix and push a new commit

#### Cannot Merge Despite Passing Checks

**Problem:** All checks are green but merge button is grayed out.

**Possible Reasons:**
- Branch is not up to date with main
- Pending review is required
- An administrator hasn't approved yet
- The branch protection rule requires additional conditions

**Solution:**
1. Click "Update branch" to sync with latest main
2. Request reviews if needed
3. Wait for required approvals

#### Stale Approval Warning

**Problem:** Approval shows "stale" after new commits.

**Explanation:** This is intentional! The branch protection rule "Dismiss stale pull request approvals" ensures reviews are based on the latest code.

**Solution:** Reviewers need to re-review and approve after new commits.

### Accessing Workflow Runs

View and debug workflow runs:

1. Go to **Actions** tab in repository
2. Select a workflow (e.g., "Test")
3. Click a run to see details
4. Expand job steps to see logs

### Secrets Management

**Issue:** Workflow fails with "secret is not defined"

**Solution:**
1. Verify secret name is exactly correct (case-sensitive)
2. Check secret is in the correct repository
3. Confirm secret value is not empty
4. For new secrets, re-run the workflow after adding

## Further Reading

- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Contributing Guide](./CONTRIBUTING.md)
- [Project Documentation](./docs/)
