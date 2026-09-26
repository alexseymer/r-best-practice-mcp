# Versioning Strategy

This document describes the versioning strategy used for the R Best Practices MCP Server.

## Semantic Versioning

The project follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH
  |      |      |
  |      |      +-- Bug fixes, backwards compatible
  |      +--------- New features, backwards compatible
  +---------------- Breaking API changes
```

### Version Format

- **Stable**: `1.0.0`, `1.2.3`, `2.0.0`
- **Pre-release**: `1.0.0-alpha.1`, `1.0.0-beta.2`, `1.0.0-rc.1`
- **Build metadata**: `1.0.0+build.123` (rarely used)

## Version Components

### MAJOR (Breaking Changes)

Increment when making backwards-incompatible changes:

- Removing or renaming MCP tools
- Changing MCP tool signatures
- Changing return types or data structures
- Removing supported workflows
- Significant architectural changes

**Examples:**
- Removing `validateProject` tool
- Changing `Finding` interface structure
- Removing support for old R versions

**Upgrading from 1.x to 2.0:**
Users may need to update their Claude configurations or scripts.

### MINOR (Features)

Increment when adding new backwards-compatible features:

- Adding new MCP tools
- Adding new workflows to support
- Adding new validation rules (as findings)
- Adding new knowledge base practices
- Improving detection accuracy

**Examples:**
- Adding support for a new R workflow type
- Adding new validation finding
- Adding new template generator features

**Upgrading from 1.0 to 1.1:**
Users automatically benefit from new features. No changes needed.

### PATCH (Bug Fixes)

Increment when fixing bugs or making internal improvements:

- Fixing validation logic
- Fixing detection algorithm
- Performance improvements
- Security fixes
- Documentation fixes

**Examples:**
- Fixing false positive in detection
- Improving file reading performance
- Fixing regex pattern in validator

**Upgrading from 1.0.0 to 1.0.1:**
Users should upgrade to get bug fixes.

## Pre-release Versions

Use pre-release versions for testing before stable release:

```
1.0.0-alpha.1   # Initial development version
1.0.0-beta.1    # Beta testing, likely to have bugs
1.0.0-rc.1      # Release candidate, feature complete
1.0.0           # Stable release
```

### When to Use

- **Alpha** - Major new features, might have design issues
- **Beta** - Feature complete, testing for bugs
- **RC** - Ready for release, final testing

### Publishing Pre-releases

```bash
# Create a pre-release version
npm version prerelease --preid=beta

# Or manually
npm version 1.0.0-beta.1

# Publish with tag
npm publish --tag beta
```

Users can opt-in to pre-releases:
```bash
npm install r-best-practices-mcp@beta
```

## Version Numbering

### Location

Version is stored in:

1. **package.json** - Single source of truth
   ```json
   {
     "version": "1.0.0"
   }
   ```

2. **package-lock.json** - Automatically updated by npm
3. **Git tags** - For releases (e.g., `v1.0.0`)

### Updating Version

Use `npm version` command (recommended):

```bash
# Patch version: 1.0.0 → 1.0.1
npm version patch

# Minor version: 1.0.1 → 1.1.0
npm version minor

# Major version: 1.1.0 → 2.0.0
npm version major

# Pre-release: 1.0.0 → 1.0.1-alpha.0
npm version prerelease --preid=alpha
```

This command will:
1. Update package.json and package-lock.json
2. Create a git commit
3. Create a git tag (e.g., `v1.0.0`)
4. Run the `version` script (format code, stage changes)

## Release Cycle

### Typical Release Pattern

```
sprint-1: Multiple minor versions
- v1.0.0 → v1.1.0 (add workflow detection)
- v1.1.0 → v1.1.1 (bug fix)
- v1.1.1 → v1.2.0 (add validation rules)

sprint-2: Major version with breaking changes
- v1.2.0 → v2.0.0-alpha.1 (redesign API)
- v2.0.0-alpha.1 → v2.0.0-beta.1 (stability improvements)
- v2.0.0-beta.1 → v2.0.0 (stable release)
```

### Release Schedule

- **Bug fixes** - Release immediately
- **Features** - Release when ready (no fixed schedule)
- **Major versions** - Plan ahead, coordinate with users
- **Pre-releases** - As needed for testing

## Compatibility Matrix

### Node.js Versions

Specify supported Node versions in package.json:

```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Breaking Changes Across Versions

| Version | Description |
|---------|-------------|
| 1.0.x | Initial release with core tools |
| 1.1.x | Added workflow support |
| 1.2.x | Added template generator |
| 2.0.0 | Major API redesign (hypothetical) |

## Deprecation Policy

### Deprecation Timeline

1. **Notice** - Announce deprecation in release notes
2. **Grace period** - Keep functionality for 2+ releases
3. **Removal** - Remove in next major version

Example:
```
v1.2.0: Deprecate "detectWorkflow" (use "detect" instead)
v1.3.0: "detectWorkflow" still works but logs warning
v1.4.0: "detectWorkflow" still available
v2.0.0: Remove "detectWorkflow" completely
```

## Commit Message Format

When creating version commits, use:

```
chore: bump version to 1.0.0

- Updated package.json
- Updated package-lock.json
- Created release tag v1.0.0

Co-Authored-By: [Your Name] <email>
```

## Release Notes

Each release should include:

- **Version number** - e.g., v1.0.0
- **Release date** - ISO format (2024-01-15)
- **Changes** - Categorized by type:
  - Breaking Changes
  - Features
  - Bug Fixes
  - Performance
  - Documentation

Example:
```markdown
# v1.1.0 (2024-01-15)

## Breaking Changes

None

## Features

- Add support for targets workflow detection
- Add 5 new validation rules for analysis projects

## Bug Fixes

- Fix detection confidence calculation
- Fix file reading on Windows

## Performance

- Improve detection speed by 20%

## Documentation

- Update README with new workflow examples
```

## Related Commands

```bash
# Show current version
npm pkg get version

# List all tags
git tag -l

# Create a tag manually
git tag v1.0.0

# Delete a tag
git tag -d v1.0.0
git push origin :v1.0.0

# Show version info
npm view r-best-practices-mcp versions

# Check installed version
npm list r-best-practices-mcp
```

## References

- [Semantic Versioning](https://semver.org/)
- [npm version documentation](https://docs.npmjs.com/cli/v8/commands/npm-version)
- [git tagging guide](https://git-scm.com/book/en/v2/Git-Basics-Tagging)
