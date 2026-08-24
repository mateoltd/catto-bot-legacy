# Dashboard Setup

This guide covers setting up and running the moderator dashboard locally.

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v10+
- The bot is already configured and running (see [Getting Started](getting-started.md))

## 1. Discord Developer Portal Setup

The dashboard uses Discord OAuth2 to authenticate moderators. You need to register a redirect URI in the Discord Developer Portal.

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Navigate to **OAuth2** in the sidebar
4. Under **Redirects**, add:

```
http://localhost:4000/api/oauth/callback
```

This is the bot's API callback endpoint — Discord will redirect users here after they authorize.

## 2. Bot Environment Variables

In your root `.env` file, ensure these three variables are set:

| Variable | Description | Example |
|----------|-------------|---------|
| `CLIENT_ID` | Your Discord application's client ID | `123456789012345678` |
| `CLIENT_SECRET` | Your Discord application's client secret | `abcdef...` |
| `API_REDIRECT` | Must **exactly match** the redirect URI registered in the Discord portal | `http://localhost:4000/api/oauth/callback` |

You also need `DASHBOARD_URL` to tell the bot where to redirect after OAuth completes:

```env
DASHBOARD_URL=http://localhost:3000
```

## 3. Dashboard Environment Variables

Create `dashboard/.env.local` with:

```env
# Server-only bot API URL (must be reachable by the dashboard runtime)
BOT_API_INTERNAL_URL=http://localhost:4000
```

Or copy from the example:

```bash
cp dashboard/.env.example dashboard/.env.local
```

## 4. Running the Dashboard

```bash
cd dashboard
pnpm install
pnpm dev
```

The dashboard will be available at `http://localhost:3000`.

Make sure the bot is also running (`pnpm dev` in the project root). Browser requests use the
dashboard's same-origin `/api/*` routes, which proxy to `BOT_API_INTERNAL_URL` on the server.

## OAuth Login Flow

When a user clicks **Login** on the dashboard, this is the full flow:

```
1. Dashboard redirects through its same-origin API proxy
   GET http://localhost:3000/api/oauth/login
                    │
                    ▼
2. Bot redirects to Discord
   GET https://discord.com/api/oauth2/authorize
   (with client_id, redirect_uri, scopes)
                    │
                    ▼
3. User authorizes on Discord
                    │
                    ▼
4. Discord redirects back to bot
   GET http://localhost:4000/api/oauth/callback?code=...
                    │
                    ▼
5. Bot exchanges code for access token (server-side)
   POST https://discord.com/api/v10/oauth2/token
                    │
                    ▼
6. Bot redirects to dashboard with an opaque session ID
   GET http://localhost:3000/api/auth/callback?sessionId=...
                    │
                    ▼
7. Dashboard sets DASHBOARD_AUTH cookie
   Redirects to /guilds
```

The critical point: the `API_REDIRECT` env var must match exactly what you registered in the Discord Developer Portal. The `DASHBOARD_URL` must match the URL where the dashboard is running.

The `DASHBOARD_AUTH` cookie is host-only. Do not configure `COOKIE_DOMAIN`: development and
production dashboard hosts must not share sessions. Each dashboard deployment should use its own
`BOT_API_INTERNAL_URL`, and the corresponding bot deployment must redirect back to that dashboard's
exact origin via `DASHBOARD_URL`.

## Mod Dashboard Authentication

The `/mod/*` routes are protected by a Next.js middleware that checks for the `DASHBOARD_AUTH` cookie. Unauthenticated users are redirected to `/mod/login`.

The mod login page reuses the same bot-backend OAuth flow described above. When the user clicks **Authenticate with Discord**:

1. A `mod_auth_redirect` cookie is set with value `/mod` (expires in 5 minutes)
2. The browser is redirected to the same-origin `/api/oauth/login` proxy
3. The standard OAuth flow runs (Discord authorize -> bot callback -> dashboard callback)
4. The dashboard auth callback checks for the `mod_auth_redirect` cookie
5. If present, it redirects to `/mod` instead of the default `/guilds`

This means no separate OAuth application or auth library is needed — the mod dashboard shares the same `DASHBOARD_AUTH` session as the rest of the dashboard. The middleware simply gates access at the Next.js layer.

### Account Switcher

The sidebar includes an `AccountSwitcher` component at the bottom. It fetches the current user from the same-origin `/api/users/@me` endpoint and provides:

- **Switch Account** — opens the OAuth flow in a popup window
- **Log Out** — calls `POST /api/oauth/logout` to clear the cookie, then redirects to `/mod/login`

## Troubleshooting

### Login button does nothing

The dashboard can't reach the bot API. Check that:
- `BOT_API_INTERNAL_URL` in `dashboard/.env.local` points to the running bot (default: `http://localhost:4000`)
- The bot is actually running

### Discord says "Invalid redirect URI"

The redirect URI registered in the Discord Developer Portal doesn't match `API_REDIRECT` in your `.env`. They must be identical, including protocol, host, port, and path:

```
http://localhost:4000/api/oauth/callback
```

### Redirects to dashboard but not logged in

The bot is redirecting to the wrong dashboard URL. Check that `DASHBOARD_URL` in your root `.env` matches where the dashboard is actually running:

```env
# Must match the dashboard's actual URL and port
DASHBOARD_URL=http://localhost:3000
```

### 401 on API calls

- Verify the bot is running and accessible from the dashboard runtime at `BOT_API_INTERNAL_URL`
- Check that the `DASHBOARD_AUTH` cookie is being set (inspect cookies in browser dev tools)
- Try logging out and logging in again

### API proxy errors

The browser never calls the bot API origin directly. If `/api/*` requests return a gateway or
connection error, verify that `BOT_API_INTERNAL_URL` is reachable from the dashboard runtime. Keep
this variable server-only; it must not use the `NEXT_PUBLIC_` prefix.

## Related

- [Getting Started](getting-started.md) - Bot setup
- [REST Routes](api/rest-routes.md) - API endpoint reference
- [Evidence System](modules/evidence.md) - Evidence upload and management
- [Architecture](architecture.md) - System design overview
