# GitHub Version Control & Production Release Notes Demo

This demo automatically creates a new version and GitHub Release whenever a pull request is merged into `main`.

## Workflow

1. Create a feature/fix branch.
2. Open a pull request to `main`.
3. Add a PR label such as `feature`, `fix`, `breaking`, `docs`, `chore`, or `refactor`.
4. Merge the PR.
5. GitHub Actions calculates the next semantic version, creates a Git tag, and publishes release notes.

## Versioning rules

| PR label | Version change | Example |
|---|---:|---|
| `breaking` | Major | `v1.0.0` → `v2.0.0` |
| `feature` | Minor | `v1.0.0` → `v1.1.0` |
| `fix` | Patch | `v1.0.0` → `v1.0.1` |
| `docs`, `chore`, `refactor`, `test`, `ci` | Patch | `v1.0.0` → `v1.0.1` |

If no label is provided, the workflow checks the PR title prefix:

- `feat:` or `feature:` → minor version
- `fix:` or `bugfix:` → patch version
- `breaking:` → major version

## Example PR titles

```text
feat: Login feature implemented
fix: Email configuration issue fixed
refactor: Improve authentication service
```

## Example release notes

```text
## What's Changed

### Features
- Login feature implemented (#12)

### Fixes
- Email configuration issue fixed (#13)

### Refactoring
- Improve authentication service (#14)

**Full Changelog**: https://github.com/OWNER/REPOSITORY/compare/v1.0.0...v1.1.0
```

## Setup

1. Create a new GitHub repository.
2. Copy this project into the repository.
3. Push the files to `main`.
4. In GitHub, open **Settings → Actions → General**.
5. Set **Workflow permissions** to **Read and write permissions**, or keep the workflow's explicit `permissions` block enabled.
6. Create PR labels if they do not already exist:
   - `feature`
   - `fix`
   - `breaking`
   - `docs`
   - `chore`
   - `refactor`
   - `test`
   - `ci`
7. Merge a PR into `main` and check the **Releases** page.

## Important behavior

- The first release starts at `v0.1.0` when the first PR is merged.
- Every subsequent merge to `main` creates a new version.
- Multiple PRs merged since the previous release are included in one release.
- Release notes are generated from PR titles, labels, and PR numbers.
- Direct pushes to `main` are ignored by this demo; use pull requests for traceable release notes.
