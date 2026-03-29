# bull-board-hono

Lightweight [Bull Board](https://github.com/felixmosh/bull-board) dashboard served via [Hono](https://hono.dev/) with multi-Redis support, optional basic auth, and automatic queue discovery.

## Features

- **Lightweight** — minimal dependencies, multi-stage Docker build (~80 MB image)
- **Multi-Redis** — monitor queues across multiple Redis instances from a single dashboard
- **Auto-discovery** — new queues are detected automatically without server restart
- **Basic auth** — optional, enabled via environment variables
- **Docker-ready** — includes Dockerfile, docker-compose, and GitHub Actions CI/CD

## Quick start

```bash
# Clone & install
git clone https://github.com/<your-org>/bull-board-hono.git
cd bull-board-hono
npm install

# Start with a local Redis
REDIS_HOST=localhost npm run dev
```

## Configuration

All configuration is done via environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `BASE_PATH` | `/` | Base URL path for the dashboard |
| `AUTH_USERNAME` | — | Basic auth username (both required to enable) |
| `AUTH_PASSWORD` | — | Basic auth password |
| `REDIS_URL` | — | Redis URL (overrides host/port/password/db/tls) |
| `REDIS_HOST` | `localhost` | Redis host (single instance mode) |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password |
| `REDIS_DB` | `0` | Redis database number |
| `REDIS_TLS` | `false` | Enable TLS for Redis connection |
| `REDIS_NAME` | `default` | Display name for the Redis instance |
| `REDIS_INSTANCES` | — | JSON array for multi-Redis (see below) |
| `QUEUE_DISCOVERY_INTERVAL` | `10000` | How often to scan for new queues (ms) |

### Redis URL

Instead of separate host/port/password variables, you can use a single URL:

```bash
REDIS_URL=redis://:password@redis-host:6379/0
REDIS_URL=rediss://redis-host:6380  # TLS via rediss:// scheme
```

### Multi-Redis

To monitor multiple Redis instances, set `REDIS_INSTANCES` as a JSON array:

```bash
REDIS_INSTANCES='[
  {"name": "main", "host": "redis-1", "port": 6379},
  {"name": "jobs", "host": "redis-2", "port": 6379, "password": "secret"},
  {"name": "cache", "host": "redis-3", "port": 6380, "db": 2, "tls": true}
]'
```

Queue names in the dashboard are prefixed with the instance name: `[main] email-queue`.

### Basic Auth

Enable by setting **both** `AUTH_USERNAME` and `AUTH_PASSWORD`:

```bash
AUTH_USERNAME=admin AUTH_PASSWORD=supersecret npm start
```

> **Security note:** Basic auth transmits credentials as Base64 (not encrypted). Always run behind a reverse proxy with TLS termination (nginx, Caddy, Traefik) in production.

### Health check

`GET /healthz` returns `200` when at least one Redis instance is connected, `503` otherwise. Always unauthenticated. Includes per-instance connection status in the response body.

## Docker

```bash
# Build
docker build -t bull-board-hono .

# Run
docker run -p 3000:3000 \
  -e REDIS_HOST=host.docker.internal \
  -e AUTH_USERNAME=admin \
  -e AUTH_PASSWORD=changeme \
  bull-board-hono
```

### Docker Compose

```bash
docker compose up
```

## CI/CD

The included GitHub Action (`.github/workflows/docker-publish.yml`) automatically builds and pushes to GitHub Container Registry on:
- Push to `main` (tagged as `main`)
- Version tags like `v1.0.0` (tagged as `1.0.0`, `1.0`, and SHA)
- Pull requests (build only, no push)

Multi-platform builds: `linux/amd64` and `linux/arm64`.

## Development

```bash
npm run dev       # Watch mode with tsx
npm run build     # Compile TypeScript
npm start         # Run compiled output
npm run typecheck # Type-check without emitting
npm run lint      # Run ESLint
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

MIT
