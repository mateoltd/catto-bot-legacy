> This is a legacy edition of Catto, the Discord bot. It is maintained temporarily as the full rewrite finishes, which is yet to decide if it'll be OSS.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher
- [pnpm](https://pnpm.io/) v10+
- [Docker](https://www.docker.com/) and Docker Compose (recommended for database)

### Running the Bot

For a seamless development experience, you can use the ephemeral environment command which sets up temporary, seeded PostgreSQL and Redis instances in RAM and starts the bot automatically:

1. Start the ephemeral environment (this will also start the bot; no separate `pnpm dev` is needed):
   ```bash
   pnpm dev:env
   ```

   This updates `.env` with the ephemeral `DATABASE_URL` and `REDIS_*` values (dev-only).

If you prefer a persistent database, you can still use Docker Compose:
```bash
docker-compose up -d
pnpm prisma:migrate
pnpm dev
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

ISC
