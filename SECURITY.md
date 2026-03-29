# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Reporting a vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Use [GitHub's private vulnerability reporting](https://github.com/wfalowski/bull-board-hono/security/advisories/new)

## Security considerations

- **Basic auth** transmits credentials as Base64 (not encrypted). Always run behind a reverse proxy with TLS termination (nginx, Caddy, Traefik) in production.
- **Redis credentials** are passed via environment variables. Use secrets management (Docker secrets, Kubernetes secrets, etc.) rather than plain `.env` files in production.
- **Dashboard access** provides visibility into job data, which may contain sensitive information. Restrict access appropriately.
