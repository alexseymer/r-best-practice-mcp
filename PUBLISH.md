# Publishing

The server is currently distributed from GitHub only. Nothing is published to npm or Docker Hub yet, and the publish
workflow does not run unless a version tag is pushed.

## Current distribution

Users install from the repository (see the [README](README.md#install)):

```bash
npm exec --yes --package=github:alexseymer/r-best-practice-mcp -- r-best-practices-mcp
```

and build the Docker image from the repository URL.

## What a release does

`.github/workflows/publish.yml` runs on a tag that matches `v*.*.*`. It:

1. runs the tests and the build on Node 18 and 20,
2. publishes the npm package with `npm publish --access public` (needs the `NPM_TOKEN` secret),
3. builds and pushes the Docker image to Docker Hub (needs `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`).

`.github/workflows/release.yml` builds the Docker image for a release and checks it over stdio.

## Before the first public release

1. Decide the version. The tool surface has changed since 0.8.5, so 0.9.0 is proposed.
2. Update `package.json` and `CHANGELOG.md` in the same pull request.
3. Make sure the repository has the `NPM_TOKEN`, `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets. Without them the
   publish job fails.
4. Tag the merged commit with `vX.Y.Z` only when the release is decided.

To publish without the workflow, run `npm publish` from a clean checkout of the tag after `npm run build`. Check the package
contents first with `npm pack --dry-run`: npm only lets you unpublish freely for a short time after a release.
