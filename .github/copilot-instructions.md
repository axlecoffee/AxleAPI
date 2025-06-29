# Copilot Instructions Log for AxleAPI

## Project Overview

-   OOP-based Express API in TypeScript
-   Entry point: `src/app.ts`
-   Uses Router for routes, controllers for logic
-   Rate limiting uses `cf-requesting-ip` header
-   Configuration via `.env` (PORT, NODE_ENV, RATE_LIMIT_MAX)
-   No JWT/auth required
-   Ready for Vitest
-   PM2 config in `ecosystem.config.js`
-   Uses pnpm as the package manager
-   Static documentation (ReDoc) served from `public/` at root
-   Introduction and rate limit info bundled into OpenAPI description
-   `openapi.yaml` is the OpenAPI spec, bundled with introduction
-   `docs:bundle` script in `package.json` auto-generates docs using `redoc-cli`

## Folder Structure

-   `src/` — TypeScript source code
    -   `app.ts` — main entry point
    -   `config/` — environment, routes, rate limiter
    -   `middleware/` — error handler, etc.
    -   `utils/` — logger, etc.
-   `public/` — static files (ReDoc docs, introduction.html)
-   `openapi.yaml` — OpenAPI spec
-   `.env` — environment variables
-   `ecosystem.config.js` — PM2 config
-   `package.json` — scripts, dependencies

## Key Practices

-   Use OOP patterns (classes for controllers/routes)
-   Use TypeScript best practices
-   Use Router for routes, controllers for logic
-   Use `cf-requesting-ip` for rate limiting
-   Use `.env` for config (PORT, NODE_ENV, RATE_LIMIT_MAX)
-   No JWT/auth required
-   Use pnpm as the package manager
-   Entry point is `src/app.ts`
-   No `server.ts`
-   Ready for Vitest
-   PM2 config in `ecosystem.config.js`
-   Serve static ReDoc docs at root from `public/`
-   Bundle introduction into OpenAPI description
-   Use JSdoc for TypeScript
-   Use camelCase for variables, PascalCase for classes
-   Use up-to-date coding styles and dependencies
-   Prefer modular, robust, and secure code
-   All scripts and automation should use pnpm

---

This file is auto-generated to help future agents quickly understand the project setup and conventions.
