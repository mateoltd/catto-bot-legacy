# Catto v2.x - Discord Bot

## Features

- **TypeScript** - Fully typed with strict mode enabled
- **Sapphire Framework** - Modern Discord bot framework with powerful features
- **Modular Architecture** - Well-organized command and event structure
- **Preconditions** - Built-in permission checks (OwnerOnly, GuildOnly, DMOnly)
- **Code Quality** - ESLint and Prettier configured for consistent code style
- **Logging** - Integrated logging system via @sapphire/plugin-logger
- **Fast Development** - Hot reload with tsx watch mode
- **REST API** - Built-in HTTP API with OAuth2 support via @sapphire/plugin-api
- **Database & Cache** - PostgreSQL (Prisma) and Redis (ioredis) integration

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher
- [pnpm](https://pnpm.io/) v10+
- [Docker](https://www.docker.com/) and Docker Compose (recommended for database)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/catto.git
   cd catto
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure environment variables:
   Copy the example environment file and fill in your bot token.
   ```bash
   cp .env.example .env
   ```

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

## Testing

Run the test suite using Vitest:

```bash
# Run tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

ISC
