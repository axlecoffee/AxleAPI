# AxleAPI

A modern, OOP-based Express API in TypeScript with:
- Entry: `src/app.ts` (no server.ts)
- Classes for controllers/routes
- IP-based rate limiting (Cloudflare `cf-requesting-ip` support, max configurable via `.env`)
- Environment management with `dotenv` and `joi`
- Error handling middleware
- PM2 cluster mode ready
- Vitest-ready with `tests/setup.ts`

## Getting Started

1. Install dependencies:
   ```sh
   pnpm install
   ```
2. Create a `.env` file (see `.env` for example values).
3. Start in development:
   ```sh
   pnpm run dev
   ```
4. Start in production (with PM2):
   ```sh
   pm2 start ecosystem.config.js --env production
   ```

## Scripts
- `pnpm run dev` — Start with ts-node
- `pnpm run test` — Run tests with Vitest

## Environment Variables
- `PORT` — Port to run the server
- `NODE_ENV` — Environment (development/production)
- `RATE_LIMIT_MAX` — Max requests per window per IP

## Testing
- Uses Vitest. See `tests/setup.ts` for server setup.

---
