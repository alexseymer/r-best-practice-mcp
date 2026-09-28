# Installation Guide - R Best Practices MCP Server

## System Requirements

### Minimum Requirements
- **Node.js:** 18.0.0 or higher
- **npm:** 8.0.0 or higher
- **RAM:** 512 MB
- **Disk Space:** 100 MB
- **OS:** Windows, macOS, Linux

### Recommended Requirements
- **Node.js:** 20.0.0 or higher (LTS)
- **npm:** 10.0.0 or higher
- **RAM:** 2 GB
- **Disk Space:** 500 MB
- **CPU:** Multi-core processor

### Operating System Support
- ✅ macOS 10.15+
- ✅ Windows 10/11
- ✅ Ubuntu 18.04+
- ✅ Debian 10+
- ✅ Alpine Linux
- ✅ CentOS 7+

## Installation Methods

### Method 1: Global NPM Installation (Recommended)

**Step 1: Install Node.js**

Download from https://nodejs.org/ (LTS recommended)

**Step 2: Install package globally**

```bash
npm install -g r-best-practices-mcp
```

**Step 3: Verify installation**

```bash
r-practices --version
# Output: 1.0.0
```

**Step 4: Test basic functionality**

```bash
r-practices analyze ~/myproject
```

**Pros:**
- Single command installation
- Available from anywhere on system
- Easy to update: `npm update -g r-best-practices-mcp`

**Cons:**
- Requires admin/sudo access
- Global package management complexity

### Method 2: Local Project Installation

**Step 1: Initialize your project (if needed)**

```bash
mkdir my-r-project
cd my-r-project
npm init -y
```

**Step 2: Install as development dependency**

```bash
npm install --save-dev r-best-practices-mcp
```

**Step 3: Add to package.json scripts**

```json
{
  "scripts": {
    "analyze": "r-practices analyze .",
    "validate": "r-practices validate"
  }
}
```

**Step 4: Run via npm**

```bash
npm run analyze
```

**Pros:**
- Project-specific version management
- No global installation required
- Easy to version control setup

**Cons:**
- Requires installation in each project
- More disk space usage

### Method 3: Docker Installation

**Step 1: Ensure Docker is installed**

```bash
docker --version
# Docker version 20.10 or higher required
```

**Step 2: Pull Docker image**

```bash
docker pull username/r-best-practices-mcp:latest
```

**Step 3: Verify image**

```bash
docker images | grep r-best-practices-mcp
```

**Step 4: Test image**

```bash
docker run r-best-practices-mcp:latest --version
```

**Pros:**
- No local Node.js installation needed
- Consistent environment across systems
- Easy to scale in containerized environments

**Cons:**
- Requires Docker installation
- Slightly more overhead than native install

### Method 4: Build from Source

**Step 1: Clone repository**

```bash
git clone https://github.com/alexseymer/r-coding-mcp.git
cd r-coding-mcp
```

**Step 2: Install dependencies**

```bash
npm install
```

**Step 3: Build from TypeScript**

```bash
npm run build
```

**Step 4: Install locally**

```bash
npm install -g .
```

**Alternative: Use without installing**

```bash
npm start
```

**Pros:**
- Access to latest development version
- Can modify code locally
- Direct access to source

**Cons:**
- Requires Node.js development tools
- Requires manual updates

## Platform-Specific Installation

### macOS

**Using Homebrew (if available):**

```bash
brew install r-best-practices-mcp
```

**Using npm:**

```bash
npm install -g r-best-practices-mcp
```

**Using Docker:**

```bash
docker pull username/r-best-practices-mcp:latest
alias r-practices='docker run --rm -v $(pwd):/app r-best-practices-mcp'
r-practices analyze .
```

### Windows

**Using npm:**

```powershell
npm install -g r-best-practices-mcp
```

**Using Chocolatey (if available):**

```powershell
choco install r-best-practices-mcp
```

**Using Docker Desktop:**

```powershell
docker pull username/r-best-practices-mcp:latest
docker run r-best-practices-mcp:latest
```

**Using WSL (Windows Subsystem for Linux):**

```bash
wsl npm install -g r-best-practices-mcp
```

### Linux

**Ubuntu/Debian:**

```bash
# Add repository (if available)
sudo add-apt-repository ppa:r-practices/ppa
sudo apt update
sudo apt install r-best-practices-mcp

# Or use npm
npm install -g r-best-practices-mcp
```

**RHEL/CentOS:**

```bash
# Using npm (preferred)
npm install -g r-best-practices-mcp

# Or with dnf
dnf install nodejs
npm install -g r-best-practices-mcp
```

**Alpine:**

```bash
# Alpine requires building from source
apk add nodejs npm git python3 make g++
npm install -g r-best-practices-mcp
```

## Verification & Testing

### Verify Installation

```bash
# Check version
r-practices --version

# Check help
r-practices --help

# Check cache
r-practices cache info
```

### Run Tests

```bash
# If installed from source
npm test

# Full test suite
npm run test:all

# Specific test file
npm run test:unit -- complexity-analyzer.test.ts
```

### Simple Example

**Create test file (example.R):**

```r
# Bad practices
myVariable <- function(x) {
  result=x+5
  return(result)
}

# Call function
output <- myVariable(10)
```

**Run analysis:**

```bash
r-practices analyze .
```

**Expected output:**

```
✓ Analyzing 1 R file
✓ Found 2 issues

Issues:
- Line 1: Function name should use snake_case (myVariable → my_variable)
- Line 2: Missing spaces around operators (result=x+5)
```

## Troubleshooting Installation

### Issue: Command not found

**Problem:** `r-practices: command not found`

**Solutions:**
```bash
# Check if npm is installed
npm --version

# Reinstall package
npm install -g r-best-practices-mcp

# Check npm global location
npm config get prefix

# Add to PATH if necessary
export PATH="$(npm config get prefix)/bin:$PATH"
```

### Issue: Permission denied

**Problem:** `Error: EACCES: permission denied`

**Solutions:**
```bash
# Option 1: Use sudo (not recommended)
sudo npm install -g r-best-practices-mcp

# Option 2: Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH

# Option 3: Use nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
npm install -g r-best-practices-mcp
```

### Issue: Version conflicts

**Problem:** `peer dependency issue`

**Solutions:**
```bash
# Clear npm cache
npm cache clean --force

# Reinstall
npm install -g r-best-practices-mcp

# Use specific version
npm install -g r-best-practices-mcp@1.0.0
```

### Issue: Docker build fails

**Problem:** `Docker build fails with "Cannot find module"`

**Solutions:**
```bash
# Clear Docker cache
docker system prune

# Rebuild
docker build --no-cache -t r-best-practices-mcp:latest .

# Use specific Node.js version in Dockerfile
# FROM node:20.10-alpine (update version)
```

## Upgrade Instructions

### From npm

**Check current version:**

```bash
r-practices --version
```

**Update to latest:**

```bash
npm install -g r-best-practices-mcp@latest
```

**Update to specific version:**

```bash
npm install -g r-best-practices-mcp@1.0.0
```

### From Docker

```bash
# Pull latest image
docker pull username/r-best-practices-mcp:latest

# Rebuild from latest
docker build --no-cache -t r-best-practices-mcp:latest .
```

### From Source

```bash
cd r-coding-mcp
git pull origin main
npm install
npm run build
npm install -g .
```

## Uninstall Instructions

### Remove npm package

```bash
# Global uninstall
npm uninstall -g r-best-practices-mcp

# Local uninstall
npm uninstall --save-dev r-best-practices-mcp
```

### Remove Docker image

```bash
# Stop running containers
docker stop $(docker ps -a -q --filter ancestor=r-best-practices-mcp)

# Remove image
docker rmi r-best-practices-mcp:latest
```

## Configuration

### Environment Variables

After installation, configure using environment variables:

```bash
# Set log level
export LOG_LEVEL=debug

# Set cache TTL
export CACHE_TTL=300000

# Set output format
export OUTPUT_FORMAT=json

# Start server
r-practices analyze ./my-project
```

### Configuration File

Create `.r-practices.json`:

```json
{
  "logLevel": "info",
  "cacheTTL": 120000,
  "outputFormat": "text",
  "strict": false,
  "workflows": {
    "package": true,
    "shiny": true,
    "analysis": true
  }
}
```

## Getting Help

### Commands Reference

```bash
# Show all commands
r-practices --help

# Show command-specific help
r-practices analyze --help
r-practices validate --help
r-practices template --help
```

### Documentation

- **README:** Project overview and quick start
- **PHASE_6_GUIDE.md:** Phase 6 features and examples
- **DEPLOYMENT.md:** Deployment to various platforms
- **PERFORMANCE_OPTIMIZATION.md:** Performance tuning
- **CLI.md:** Complete CLI reference

### Support

- **GitHub Issues:** https://github.com/alexseymer/r-coding-mcp/issues
- **Discussions:** https://github.com/alexseymer/r-coding-mcp/discussions
- **Email:** alexseymer@gmail.com

## Next Steps

After installation:

1. **Read Quick Start:** See README.md for basic usage
2. **Run Examples:** Try example projects in `examples/`
3. **Configure:** Set up `.r-practices.json` for your workflow
4. **Integrate:** Add to CI/CD pipeline
5. **Customize:** Create custom rules for your team

## Version Information

**Current Version:** 1.0.0 (Phase 6)
**Node.js Support:** 18.0.0+
**Release Date:** 2026-09-28

**System Information:**

```bash
# Check your system
node --version
npm --version
uname -a
```
