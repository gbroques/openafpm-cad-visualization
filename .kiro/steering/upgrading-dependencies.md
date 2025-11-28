# Upgrading Dependencies

## Process

1. **Check for outdated packages**
   ```bash
   npm outdated
   ```

2. **Update packages individually**
   
   Update one package at a time to isolate issues:
   ```bash
   yarn upgrade <package-name>@latest
   ```

3. **Test after each update**
   ```bash
   npm run build
   ```
   Then manually test in browser if needed.

4. **Commit each update separately**
   ```bash
   git add package.json yarn.lock
   git commit -m "chore(deps): update <package-name> to <version>"
   git push
   ```

## Checking for Breaking Changes

Before upgrading, check for breaking changes:

### For npm packages

1. **Check release notes on GitHub**
   ```
   https://github.com/<org>/<repo>/releases
   ```

2. **Look for migration guides**
   - Check README for migration sections
   - Search for "BREAKING CHANGE" in release notes
   - Look for major version bumps (e.g., 2.x → 3.x)

3. **Search for specific version changes**
   ```
   <package-name> v<old-version> to v<new-version> breaking changes
   ```

### Example: camera-controls

When upgrading camera-controls from 2.7.2 to 3.1.2:

1. Found releases page: https://github.com/yomotsu/camera-controls/releases
2. Identified v3.0.0 had breaking changes
3. Found migration guide in README: https://github.com/yomotsu/camera-controls#v3-migration-guide
4. Tested incrementally: 2.7.2 → 2.7.3 → 2.10.1 → 3.0.0 → 3.1.2

## Tips

- Update patch/minor versions first (safer)
- Be cautious with major version bumps
- Test thoroughly after major updates
- Keep commits atomic (one package per commit)
