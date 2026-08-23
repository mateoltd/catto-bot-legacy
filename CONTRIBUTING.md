# Contributing to Catto

Quick and clear guidelines for contributing to this project.

## TL;DR

1. Create a branch: `feature/my-feature` or `fix/my-fix`
2. Make focused changes (one purpose per PR)
3. Use conventional commits: `feat: add login button`
4. Open a PR with a clear title: `[feature]: Add user dashboard`
5. Wait for review

## Branch Naming

| Type | Format | Example |
|------|--------|---------|
| Feature | `feature/description` | `feature/add-xp-leaderboard` |
| Fix | `fix/description` | `fix/ban-command-error` |
| Refactor | `refactor/description` | `refactor/moderation-service` |
| Docs | `docs/description` | `docs/api-endpoints` |

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `test` - Tests
- `chore` - Maintenance

**Examples:**
```
feat(moderation): add warn command
fix(xp): resolve cooldown calculation
docs(api): add redis documentation
refactor(commands): extract validation logic
```

## Pull Request Guidelines

### PR Titles

Use the format: `[type]: description`

**Good:**
- `[feature]: Add voice XP system`
- `[fix]: Resolve timeout duration parsing`
- `[refactor]: Improve moderation service structure`

**Bad:**
- `Update files`
- `Fix stuff`
- `WIP`

### One PR = One Purpose

Each PR should have a single, focused objective.

**Good:**
- PR adds the warn command
- PR fixes the ban error
- PR refactors the XP module

**Bad:**
- PR adds warn command AND fixes unrelated UI bug AND updates docs
- PR started as "add feature X" but also includes "fix Y" and "refactor Z"

### Don't Nest PRs

Don't merge unrelated PRs into each other. If you have multiple features:

1. Create separate branches
2. Create separate PRs
3. Let each get reviewed independently

### Before Opening a PR

- [ ] Code compiles (`pnpm build`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Format is correct (`pnpm format:check`)
- [ ] Types are correct (`pnpm typecheck`)
- [ ] Tests pass (if applicable) (`pnpm test`)

## Development Setup

### Quick Start

```bash
# Install dependencies
pnpm install

# Start with ephemeral database
pnpm dev:env
```

This updates `.env` with the ephemeral `DATABASE_URL` and `REDIS_*` values for local development.

### Manual Setup

```bash
# Start services
docker-compose up -d

# Run migrations
pnpm prisma:migrate

# Start dev server
pnpm dev
```

## Code Style

We use ESLint and Prettier. Your editor should auto-format.

### Key Rules

- Single quotes for strings
- 2 spaces for indentation
- Semicolons required
- Use `import type` for type-only imports
- Prefix unused params with `_`

See [docs/RULES.md](docs/RULES.md) for complete guidelines.

## Making Changes

### Adding a Command

1. Create file in `src/commands/[category]/`
2. Follow the pattern in existing commands
3. Use Gate for validation
4. Use FluentContainer for responses

### Adding a Listener

1. Create file in `src/listeners/[category]/`
2. Follow the pattern in existing listeners
3. Handle errors gracefully

### Modifying Database

1. Update `prisma/schema.prisma`
2. Run `pnpm prisma:migrate`
3. Update relevant services

## Getting Help

- Check [existing documentation](docs/README.md)
- Look at similar code in the codebase
- Ask in the team chat

## Quick Reference

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start dev server |
| `pnpm dev:env` | Start with ephemeral DB + update `.env` |
| `pnpm build` | Compile TypeScript |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Fix ESLint issues |
| `pnpm format` | Format code |
| `pnpm typecheck` | Check types |
| `pnpm test` | Run tests |
| `pnpm docs:all` | Serve documentation |
| `pnpm prisma:migrate` | Run migrations |
| `pnpm prisma:studio` | Open Prisma Studio |
