# Setting Up NPM Publishing

This guide helps you set up automated npm publishing for this repository.

## Step 1: Generate NPM Token

1. Log in to your npm account at https://www.npmjs.com
2. Click on your profile icon in the top right
3. Select "Access Tokens" from the dropdown menu
4. Click "Generate New Token"
5. Select **"Automation"** token type (recommended for CI/CD)
6. Give it a descriptive name like "GitHub Actions - kivg-typescript"
7. Click "Generate Token"
8. **Important**: Copy the token immediately - you won't be able to see it again!

## Step 2: Add Token to GitHub Secrets

1. Go to your GitHub repository: https://github.com/armelgeek/engine
2. Click on "Settings" tab
3. In the left sidebar, click on "Secrets and variables" > "Actions"
4. Click the "New repository secret" button
5. Enter the following:
   - **Name**: `NPM_TOKEN`
   - **Secret**: Paste the npm token you copied in Step 1
6. Click "Add secret"

## Step 3: Verify Package Name

Before publishing, ensure the package name is available on npm:

1. Go to https://www.npmjs.com/package/kivg-typescript
2. If the page doesn't exist or shows "404", the name is available
3. If the package already exists, ensure you have publishing rights to it

## Step 4: Publish Your First Release

### Option A: Using GitHub Releases (Recommended)

1. **Update version** in package.json:
   ```bash
   npm version patch   # For bug fixes (1.0.0 -> 1.0.1)
   npm version minor   # For new features (1.0.0 -> 1.1.0)
   npm version major   # For breaking changes (1.0.0 -> 2.0.0)
   git push --follow-tags
   ```

2. **Create a release on GitHub**:
   - Go to https://github.com/armelgeek/engine/releases/new
   - Select the tag you just created (e.g., v1.0.1)
   - Add a title: "v1.0.1"
   - Add release notes describing what's new
   - Click "Publish release"

3. **Monitor the publish**:
   - Go to the "Actions" tab
   - You should see the "Publish to npm" workflow running
   - Wait for it to complete successfully (green checkmark)

4. **Verify on npm**:
   - Visit https://www.npmjs.com/package/kivg-typescript
   - You should see your package with the new version

### Option B: Manual Publish from Local Machine

If you prefer to publish manually:

```bash
# Ensure you're logged in
npm login

# Build and test
npm run clean
npm run build:lib
npm run type-check

# Verify package contents
npm pack --dry-run

# Publish
npm publish
```

## Troubleshooting

### "npm ERR! 403 Forbidden"
- Verify your npm token is valid
- Ensure the token has the correct permissions (Automation type)
- Make sure the token is correctly added to GitHub Secrets

### "npm ERR! You do not have permission to publish"
- The package name might be taken by someone else
- You might need to use a scoped package name: `@yourusername/kivg-typescript`
- Contact npm support if you believe you should have access

## Security Best Practices

✅ **DO**:
- Use "Automation" token type for CI/CD
- Store tokens in GitHub Secrets, never in code
- Regularly rotate your npm tokens
- Enable 2FA on your npm account

❌ **DON'T**:
- Commit tokens to the repository
- Share tokens in plain text
- Use the same token for multiple purposes
- Give tokens more permissions than needed

## Additional Resources

- [npm documentation on tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens)
- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [Publishing Node.js packages](https://docs.github.com/en/actions/publishing-packages/publishing-nodejs-packages)
- [Semantic Versioning](https://semver.org/)
