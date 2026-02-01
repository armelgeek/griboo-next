# Publishing Guide

This document describes how to publish the `kivg-typescript` package to npm.

## Automated Publishing with GitHub Actions

The repository is configured with a GitHub Actions workflow that automatically publishes to npm when a new release is created.

### Setup (One-time)

1. **Generate an npm access token**:
   - Go to https://www.npmjs.com/settings/[your-username]/tokens
   - Click "Generate New Token" > "Automation" (for CI/CD publishing)
   - Copy the generated token

2. **Add the token to GitHub Secrets**:
   - Go to your GitHub repository
   - Navigate to Settings > Secrets and variables > Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click "Add secret"

### Publishing Process

#### Method 1: Create a GitHub Release (Recommended)

1. **Update the version in package.json**:
   ```bash
   npm version patch  # or minor, or major
   git push --follow-tags
   ```

2. **Create a new release on GitHub**:
   - Go to your repository on GitHub
   - Click "Releases" > "Create a new release"
   - Choose the tag you just pushed (e.g., `v1.0.1`)
   - Add release notes describing the changes
   - Click "Publish release"

3. **Automated workflow runs**:
   - The `npm-publish.yml` workflow will automatically trigger
   - It will install dependencies, run tests, build the library, and publish to npm
   - Check the Actions tab to monitor the progress

#### Method 2: Manual Workflow Dispatch

You can also trigger the publish workflow manually from the GitHub Actions tab:

1. Go to the "Actions" tab in your repository
2. Select the "Publish to npm" workflow
3. Click "Run workflow"
4. Ensure you've already bumped the version in package.json before running

## Manual Publishing (Local)

If you need to publish manually from your local machine:

### Prerequisites

1. **Ensure you're logged in to npm**:
   ```bash
   npm login
   ```

2. **Verify your account has publish rights**:
   - Check that you're a maintainer of the package

### Steps

1. **Clean and build**:
   ```bash
   npm run clean
   npm install
   npm run type-check
   npm run build:lib
   ```

2. **Verify the package contents**:
   ```bash
   npm pack --dry-run
   ```
   Review the list of files that will be included. Ensure:
   - `dist/` directory is included
   - `src/` directory is included (for source maps)
   - `static/` directory is included
   - Dev files are excluded (.parcel-cache, node_modules, etc.)

3. **Bump the version**:
   ```bash
   npm version patch   # for bug fixes
   npm version minor   # for new features
   npm version major   # for breaking changes
   ```

4. **Publish to npm**:
   ```bash
   npm publish
   ```

5. **Push the version tag**:
   ```bash
   git push --follow-tags
   ```

## Version Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **Patch** (1.0.x): Bug fixes, documentation updates, no breaking changes
- **Minor** (1.x.0): New features, no breaking changes
- **Major** (x.0.0): Breaking changes to the API

## Pre-release Versions

For beta or pre-release versions:

```bash
# First time creating a prerelease
npm version prerelease --preid=beta  # 1.0.0 -> 1.0.1-beta.0

# Subsequent prereleases
npm version prerelease  # 1.0.1-beta.0 -> 1.0.1-beta.1

# Publish with beta tag
npm publish --tag beta
```

Users can install pre-release versions with:
```bash
npm install kivg-typescript@beta
```

## Verifying the Published Package

After publishing, verify the package:

1. **Check on npm**:
   - Visit https://www.npmjs.com/package/kivg-typescript
   - Verify the version number
   - Check the files included in the package

2. **Test installation**:
   ```bash
   mkdir test-install
   cd test-install
   npm init -y
   npm install kivg-typescript
   ```

3. **Test imports**:
   ```javascript
   // Test in a Node.js file
   const { Whiteboard } = require('kivg-typescript');
   const { ServerWhiteboard } = require('kivg-typescript/server');
   console.log('Imports successful!');
   ```

## Troubleshooting

### "npm ERR! 403 Forbidden"

- Verify you're logged in: `npm whoami`
- Verify you have publish rights to the package
- Check that your npm token is valid and has the correct permissions

### "npm ERR! You do not have permission to publish"

- Ensure the package name in `package.json` is available or that you own it
- If it's a scoped package (e.g., `@username/package`), use `npm publish --access public`

### Build Errors

- Run `npm run clean` to remove old build artifacts
- Delete `node_modules` and `package-lock.json`, then run `npm install`
- Ensure all TypeScript files compile: `npm run type-check`

## Workflow Configuration

The GitHub Actions workflow (`.github/workflows/npm-publish.yml`) includes:

- **Provenance**: Publishes with npm provenance for supply chain security
- **Node.js 20.x**: Uses the LTS version of Node.js
- **Build verification**: Runs type-check and build before publishing
- **Automatic tagging**: Creates git tags for manual workflow runs

## Security Notes

- Never commit npm tokens or credentials to the repository
- Use GitHub Secrets for storing sensitive information
- The `NPM_TOKEN` secret should be an "Automation" token with publish permissions
- Consider enabling 2FA on your npm account for additional security
