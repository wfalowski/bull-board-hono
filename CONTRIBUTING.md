# Contributing to bull-board-hono

Thanks for your interest in contributing!

## Prerequisites

- Node.js 20+
- Docker (for local development with Redis)

## Setup

```bash
git clone https://github.com/<your-org>/bull-board-hono.git
cd bull-board-hono
npm install
docker compose up -d redis   # start Redis
npm run dev                   # start dev server with hot reload
```

## Development workflow

1. Fork the repository and create a feature branch from `main`
2. Make your changes
3. Ensure quality checks pass:
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```
4. Commit with a clear message describing *what* and *why*
5. Open a pull request against `main`

## Code style

- TypeScript strict mode
- [Biome](https://biomejs.dev/) for linting and formatting (run `npm run lint` to check, `npm run format` to auto-format)
- No `any` types — use `unknown` with proper narrowing
- Keep dependencies minimal — this project prioritizes being lightweight

## Reporting bugs

Please use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, Docker version, Redis version)

## Feature requests

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md). Describe the use case, not just the solution.
