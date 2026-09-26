# GitHub Setup and Configuration - Detailed Guide

This guide provides step-by-step instructions for setting up the R Best Practices MCP GitHub repository with branch protection rules, status checks, and automated workflows.

## Overview

The R Best Practices MCP uses GitHub Actions for continuous integration and GitHub branch protection to enforce code quality standards. This guide walks through:

1. Setting up branch protection rules
2. Configuring required status checks
3. Adding repository secrets
4. Understanding the automation workflows
5. Troubleshooting common issues

## Table of Contents

1. [Branch Protection Setup](#branch-protection-setup)
2. [Status Checks Matrix](#status-checks-matrix)
3. [Workflow Configuration](#workflow-configuration)
4. [Repository Secrets](#repository-secrets)
5. [Pull Request Workflow](#pull-request-workflow)
6. [Debugging and Troubleshooting](#debugging-and-troubleshooting)

## Branch Protection Setup

### Step-by-Step: Enable Main Branch Protection

#### 1. Navigate to Branch Settings

1. Go to your GitHub repository homepage
2. Click **Settings** (gear icon in the top right)
3. In the left sidebar, click **Branches**
4. You should see "Branch protection rules" section

#### 2. Add Branch Protection Rule

1. Click **Add rule**
2. In the "Branch name pattern" field, enter: `main`
3. Scroll down to configure the following settings

#### 3. Configure Protection Settings

**Enable These Required Protections:**

```
☑ Require a pull request before merging
  ☑ Require approvals (set to: 1)
  ☑ Dismiss stale pull request approvals when new commits are pushed
  ☑ Require approval of the most recent reviewable push

☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  ☐ Require code to pass a specified status check
     (Add the following checks):
     - test
     - docker
     - release

☑ Include administrators
```

**Optional Settings** (can be enabled for enhanced security):

```
☐ Restrict who can push to matching branches
☐ Require conversation resolution before merging
☐ Require commit signatures
☐ Require linear history
☐ Require deployments to succeed before merging
```

#### 4. Save the Rule

Click **Create** to save the branch protection rule.

### Understanding the Settings

| Setting | Purpose | Recommended |
|---------|---------|-------------|
| Require pull request reviews | Ensures code is reviewed before merging | Yes (1 approval) |
| Dismiss stale approvals | Ensures reviews are current with latest code | Yes |
| Require status checks | Ensures all tests and builds pass | Yes |
| Require up to date | Prevents merging out-of-sync branches | Yes |
| Include administrators | Rules apply to everyone, including admins | Yes |
| Commit signatures | Requires cryptographic signing of commits | Optional |
| Linear history | Requires rebasing/squashing (no merge commits) | Optional |

### Verification

To verify branch protection is working:

1. Go to a pull request to main
2. You should see "1 approved" required in the merge section
3. You should see required status checks (test, docker, release)
4. The merge button should be disabled until all checks pass and approval is given

## Status Checks Matrix

### Workflow Jobs and Status Checks

The following GitHub Actions workflows provide required status checks:

#### Test Workflow

**File:** `.github/workflows/test.yml`

```yaml
name: Test
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # Daily

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run build
```

**Required Check Name:** `test`

**What It Tests:**
- Unit tests (Jest)
- Code coverage (must be 70%+)
- TypeScript compilation
- Build process

**Runs On:** Every push to main, every PR, daily at midnight

#### Docker Workflow

**File:** `.github/workflows/docker.yml`

```yaml
name: Docker
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  docker:
    name: Build Docker Image
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: false
          cache-from: type=registry
          cache-to: type=inline
```

**Required Check Name:** `docker`

**What It Tests:**
- Docker image builds successfully
- All dependencies are available in the image
- Image structure is correct

**Runs On:** Every push to main, every PR

#### Release Workflow

**File:** `.github/workflows/release.yml`

```yaml
name: Release
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  release:
    name: Create Release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm test
      # Create release if version changed
```

**Required Check Name:** `release`

**What It Tests:**
- Release readiness (version, changelog, etc.)
- All builds succeed
- Package metadata is correct

**Runs On:** Push to main, manual trigger

### Status Check Dependency Chain

```
PR Created
    ↓
Trigger: push to PR branch
    ↓
├─→ test workflow (npm test, npm build)
├─→ docker workflow (docker build)
└─→ Other checks
    ↓
All Pass? ✓
    ↓
Merge allowed (with approval)
    ↓
PR Merged to main
```

## Workflow Configuration

### Adding a New Status Check

If you need to add another required status check:

1. Create a new workflow file in `.github/workflows/`
2. Make sure it has a `jobs` section with a job ID (e.g., `lint`)
3. Add the workflow to the branch protection rule:
   - Go to Settings → Branches → Edit branch protection rule
   - Under "Require status checks to pass," add the new job ID
4. Commit and test on a PR

### Viewing Workflow Runs

**From the Repository:**

1. Click **Actions** tab
2. Select a workflow (e.g., "Test")
3. Click a run to see details
4. Click a job to see full logs

**Key Information:**
- Run time and status
- Triggered by (push, PR, schedule)
- Which commit/branch
- Detailed logs for each step

### Re-Running a Failed Workflow

If a workflow fails and you fix the issue:

1. Go to the failed run
2. Click **Re-run failed jobs** or **Re-run all jobs**
3. The workflow will run again with the same commit

## Repository Secrets

### What Secrets Are Needed?

| Secret | Purpose | How to Get |
|--------|---------|-----------|
| NPM_TOKEN | Publish to npm registry | npm.com account settings |
| DOCKER_USERNAME | Docker Hub login | Docker Hub account |
| DOCKER_PASSWORD | Docker Hub access token | Docker Hub account settings |
| GITHUB_TOKEN | Built-in, no setup needed | Automatic |

### Setting Up NPM_TOKEN

**Prerequisites:** npm account with publish permissions

**Steps:**

1. Go to [https://www.npmjs.com/settings/YOUR_USERNAME/tokens](https://www.npmjs.com/settings/YOUR_USERNAME/tokens)
2. Click **Generate New Token**
3. Choose **Automation** token type
4. Select scope: **publish:automation**
5. Click **Generate token**
6. Copy the token (you won't see it again!)
7. Go to GitHub repo Settings → Secrets and variables → Actions
8. Click **New repository secret**
9. Name: `NPM_TOKEN`
10. Value: Paste the token
11. Click **Add secret**

### Setting Up Docker Credentials

**Prerequisites:** Docker Hub account

**Steps:**

1. Go to [https://hub.docker.com/settings/security](https://hub.docker.com/settings/security)
2. Click **New Access Token**
3. Enter a description (e.g., "GitHub Actions - r-best-practice-mcp")
4. Select access permissions: **Read, Write** (for push)
5. Click **Generate**
6. Copy the token
7. Go to GitHub repo Settings → Secrets and variables → Actions
8. Add two secrets:
   - `DOCKER_USERNAME`: Your Docker Hub username
   - `DOCKER_PASSWORD`: The access token from step 6

### Verification

After adding secrets:

1. Go to Settings → Secrets and variables → Actions
2. You should see the secrets listed (values are masked)
3. Run a workflow that uses the secrets
4. Check the workflow logs (secrets won't be printed)

## Pull Request Workflow

### From Developer Perspective

#### 1. Create Feature Branch

```bash
git checkout -b feature/my-feature
```

#### 2. Make Changes and Commit

```bash
# Make changes to files
git add .
git commit -m "feat: Add new feature"
# Follow commit message format from CONTRIBUTING.md
```

#### 3. Push Branch

```bash
git push origin feature/my-feature
```

#### 4. Create Pull Request

1. Go to repository on GitHub
2. Click **Compare & pull request** button
3. Fill in PR template:
   - Description
   - Type of change
   - Testing
   - Checklist
4. Click **Create pull request**

#### 5. Wait for Status Checks

The PR page will show:
- Status checks running (⏳ in progress)
- Status checks passed (✓ green)
- Status checks failed (✗ red)

Do NOT merge until all checks pass (unless you're bypassing branch protection).

#### 6. Request Review

1. On the PR page, click **Reviewers**
2. Select one or more reviewers
3. Reviewers get notified

#### 7. Address Feedback

1. Review comments on the PR
2. Make changes locally
3. Commit and push

```bash
git add .
git commit -m "fix: Address feedback"
git push origin feature/my-feature
```

Status checks re-run automatically. Previous approvals become "stale" and reviewers need to re-approve.

#### 8. Merge

Once all checks pass and at least 1 approval is received:
1. Click **Merge pull request**
2. Select merge strategy (squash recommended)
3. Click **Confirm merge**
4. Click **Delete branch** (optional but recommended)

### Automated Merge (Optional)

Enable auto-merge to merge automatically when requirements are met:

1. On PR page, scroll down
2. Click **Auto-merge** → Select strategy (Squash)
3. Dismiss any conflicts if necessary
4. PR merges automatically when all checks pass

## Debugging and Troubleshooting

### Workflow Debugging

#### Check Workflow Status

On a PR, scroll to the bottom to see all status checks:

```
✓ test (passing)
✓ docker (passing)
○ release (waiting to run)
```

Click any check to see details.

#### View Detailed Logs

1. Click on a failed check
2. You're taken to the GitHub Actions workflow page
3. Click the failed job to expand it
4. See all steps and their output
5. Look for error messages

Example error locations:
- `npm test` failures → Look for test output and assertions
- Build failures → TypeScript errors or missing dependencies
- Docker build → Missing files or invalid Dockerfile syntax

#### Re-run Failed Workflows

If the failure is transient (e.g., temporary network issue):

1. Go to Actions tab
2. Find the failed run
3. Click **Re-run failed jobs** or **Re-run all jobs**

### Common Issues and Solutions

#### Issue: "Status check 'test' is not passing"

**Cause:** Tests are failing

**Solution:**
```bash
# Run tests locally
npm test

# View the failing test
npm test -- --verbose

# Fix the issue
# ... edit files ...

# Verify it passes
npm test

# Commit and push
git add .
git commit -m "fix: Fix failing tests"
git push
```

#### Issue: "Status check 'docker' is not passing"

**Cause:** Docker image won't build

**Solution:**
```bash
# Build Docker image locally
docker build -f Dockerfile .

# Look for error messages
# Common issues:
#   - Missing files referenced in Dockerfile
#   - Wrong file paths
#   - npm install failures

# Fix the issue and retry
docker build -f Dockerfile .

# Push the fix
git commit -m "fix: Fix Docker build"
git push
```

#### Issue: "The merge button is disabled"

**Possible Causes:**

1. **Not all status checks have passed**
   - Wait for checks to complete
   - If they fail, fix and push again

2. **No approval**
   - Request a review from a colleague
   - Wait for them to approve

3. **Branch is out of date with main**
   - Click **Update branch** button
   - Conflicts? Resolve them locally:
   ```bash
   git fetch origin
   git merge origin/main
   # Resolve conflicts
   git add .
   git commit -m "Merge main into feature branch"
   git push
   ```

4. **Waiting for required status checks**
   - Some checks might be pending
   - Look at the PR status section
   - If stuck, try re-running the workflow

#### Issue: "Approval has become stale"

**Explanation:** This is intentional—new commits invalidate previous approvals to ensure reviewers approve the latest code.

**Solution:**
1. Go to PR
2. Request review again from the same reviewer
3. They review the new changes
4. They approve again

### Checking Workflow YAML Syntax

If a workflow isn't running at all, the YAML might be invalid:

1. Go to `.github/workflows/` in the repository
2. Click the workflow file
3. GitHub shows a checkmark (valid) or error (invalid)
4. Look at `.github/workflows/` in Actions tab for parsing errors

To validate locally:

```bash
# Install yamllint (optional)
npm install -D yamllint

# Validate
yamllint .github/workflows/*.yml
```

### Getting Help

1. Check [GitHub Actions Troubleshooting](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows)
2. Read the specific workflow's logs
3. Search [GitHub Discussions](https://github.com/r-best-practices/r-best-practice-mcp/discussions)
4. Check the [CONTRIBUTING.md](../CONTRIBUTING.md) guide

## Next Steps

After setting up branch protection:

1. ✅ Verify branch protection is enabled
2. ✅ Test by creating a PR without passing checks
3. ✅ Confirm merge is blocked
4. ✅ Fix issues and verify merge is allowed
5. ✅ Review [CONTRIBUTING.md](../CONTRIBUTING.md) for development workflow
6. ✅ Share this guide with team members

## References

- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Contributing Guide](../CONTRIBUTING.md)
- [GitHub Setup Summary](../GITHUB_SETUP.md)
