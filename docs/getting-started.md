# Getting Started

This guide will help you set up and run Catto v2.x locally for development.

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher
- [pnpm](https://pnpm.io/) v10+
- [Docker](https://www.docker.com/) and Docker Compose (recommended)
- [Rust](https://rustup.rs/) (optional, for watermark and image-gen microservices)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/cattxdev/catto.v2.git
cd catto
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Build Rust Microservices (Optional)

For faster evidence image processing, build the Rust watermark microservice:

```bash
cd services/watermark-rs
cargo build --release
cd ../..
```

If not built, the bot will use Sharp-based watermarking as a fallback.

For image generation (rank cards, leaderboards, bonk memes), build the Rust image-gen microservice:

```bash
cd services/image-gen-rs
cargo build --release
cd ../..
```

The image-gen service is required for generating images. It is automatically started by `pnpm dev:env` if the binary exists.

### 4. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Fill in the required values:

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Your Discord bot token | Yes |
| `CLIENT_ID` | Discord application client ID | Yes |
| `CLIENT_SECRET` | Discord application client secret | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_HOST` | Redis server host | Yes |
| `REDIS_PORT` | Redis server port | Yes |
| `REDIS_PASSWORD` | Redis password (if any) | No |
| `REDIS_DB` | Redis database number | No |
| `OWNER_IDS` | Comma-separated owner user IDs | No |
| `DEFAULT_PREFIX` | Default command prefix | No |
| `API_PORT` | HTTP API port (default: 4000) | No |
| `API_PREFIX` | API route prefix | No |
| `API_ORIGIN` | OAuth2 origin URL | No |
| `API_REDIRECT` | OAuth2 redirect URL | No |
| `B2_ENDPOINT` | Backblaze B2 S3 endpoint (e.g. `https://s3.us-west-004.backblazeb2.com`) | No |
| `B2_REGION` | B2 region (e.g. `us-west-004`) | No |
| `B2_KEY_ID` | B2 application key ID (not master key) | No |
| `B2_APP_KEY` | B2 application key secret | No |
| `B2_BUCKET_NAME` | B2 bucket name | No |
| `B2_BUCKET_ID` | B2 bucket ID | No |
| `EVIDENCE_HMAC_SECRET` | Secret for evidence HMAC signing (min 32 chars) | No |
| `DASHBOARD_URL` | Moderator dashboard URL (default: `http://localhost:3000`) | No |
| `WATERMARK_SERVICE_URL` | Watermark microservice URL (default: `http://localhost:3847`) | No |
| `WATERMARK_MAX_UPLOAD_SIZE` | Max watermark upload size (default: `1gb`) | No |
| `IMAGE_GEN_SERVICE_URL` | Image generation microservice URL (default: `http://localhost:3848`) | No |

## Running the Bot

### Option 1: Ephemeral Environment (Recommended for Development)

This starts temporary PostgreSQL and Redis instances in RAM:

```bash
pnpm dev:env
```

The script will:
- Start PostgreSQL and Redis containers
- Update `.env` with ephemeral `DATABASE_URL` and `REDIS_*` values (dev-only)
- Start the watermark microservice (if built)
- Apply migrations and seed the database
- Start the bot in watch mode

### Option 2: Persistent Database

Use Docker Compose for persistent storage:

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Run migrations
pnpm prisma:migrate

# Start the bot in development mode
pnpm dev
```

## Image Generation

Catto uses a Rust microservice (`image-gen-rs`) for all image generation (rank cards, leaderboards, bonk memes). The service uses `tiny-skia` for 2D rendering and `cosmic-text` for font layout, producing images significantly faster than the previous Puppeteer-based approach.

### Building

```bash
cd services/image-gen-rs
cargo build --release
```

The binary is automatically started by `pnpm dev:env` if found at `services/image-gen-rs/target/release/image-gen-service`.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `IMAGE_GEN_SERVICE_URL` | `http://localhost:3848` | URL of the image-gen microservice |

### How It Works

The TypeScript bot communicates with the Rust service via HTTP (JSON request → PNG response). The `imageGenClient` in `src/lib/services/image-gen-client.ts` handles health checks, timeouts, and error reporting.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/bonk` | POST | Generate bonk meme image |
| `/rank` | POST | Generate XP rank card |
| `/leaderboard` | POST | Generate leaderboard card |

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start bot in watch mode |
| `pnpm dev:env` | Start with ephemeral database + update `.env` |
| `pnpm build` | Compile TypeScript |
| `pnpm start` | Run compiled bot |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Fix ESLint issues |
| `pnpm format` | Format code with Prettier |
| `pnpm typecheck` | Type-check without emitting |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm docs:all` | Serve documentation locally |

### Prisma Scripts

| Script | Description |
|--------|-------------|
| `pnpm prisma:generate` | Generate Prisma client |
| `pnpm prisma:migrate` | Run migrations |
| `pnpm prisma:migrate:create -- <name>` | Create migration safely for ephemeral DB flow |
| `pnpm prisma:studio` | Open Prisma Studio |
| `pnpm prisma:push` | Push schema changes |
| `pnpm prisma:seed` | Seed the database |
| `pnpm prisma:reset` | Reset the database |

## Project Structure

```
catto/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Environment validation
│   ├── structures/           # BotClient and core structures
│   ├── commands/             # Slash commands
│   ├── listeners/            # Event handlers
│   ├── routes/               # REST API endpoints
│   ├── modules/              # Business logic modules
│   ├── lib/                  # Utilities and helpers
│   │   ├── services/         # Image generation client, storage, etc.
│   │   ├── storage/          # B2 storage and signing services
│   │   └── validation/       # Gate, permissions, rate limiting
│   ├── preconditions/        # Permission checks
│   └── interactions/         # Button/modal handlers
├── dashboard/                # Next.js moderator dashboard
│   ├── app/mod/              # Mod dashboard pages
│   ├── components/mod/       # Evidence gallery, viewer, upload
│   └── lib/                  # Services and types
├── services/
│   ├── watermark-rs/         # Rust watermark microservice
│   └── image-gen-rs/         # Rust image generation microservice
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # Database seeder
├── languages/                # i18n translations
├── docs/                     # Documentation (you are here)
└── docker-compose.yml        # Docker services
```

## Next Steps

- [Dashboard Setup](dashboard.md) — Run the moderator dashboard and configure OAuth login
- Read the [Architecture](architecture.md) overview
- Learn about [Coding Rules](RULES.md)
- Explore the [Internal APIs](api/index.md)
- Use the [Prisma Migrations guide](api/prisma-migrations.md) when creating schema migrations with ephemeral DBs
- Create your first [Command](commands/creating-commands.md)
