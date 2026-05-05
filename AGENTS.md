# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router routes and layouts (`[locale]` contains Arabic/English pages).
- `src/components`: UI and domain components (`ui/`, `products/`, `auth/`, `admin/`, etc.).
- `src/lib`: Business logic and integrations (`auth`, `database`, `scraping`, `cart`, `analytics`).
- `tests`: Jest test suites (`tests/auth`, `tests/database`, `tests/utils.test.ts`).
- `scripts/database`: SQL schema, RLS policies, seed, and migration files.
- `scripts/scraping`: Python/Flask scraping service used by search flows.
- `public` and `messages/{en,ar}`: static assets and localized messages.

## Build, Test, and Development Commands
- `npm run dev`: Start Next.js development server.
- `npm run build` / `npm run start`: Build and run production mode.
- `npm run lint`: Run ESLint (Next.js core-web-vitals + TypeScript config).
- `npm test`: Run all Jest tests.
- `npm run test:watch`: Run tests in watch mode.
- `npm run test:coverage`: Run tests with coverage reporting.
- `npm run test:db`: Run database-focused tests only.
- `npm run flask:start`: Start the local Flask scraping API.
- `npm run db:setup`: Apply schema, RLS policies, and seed data to Supabase/Postgres.

## Coding Style & Naming Conventions
- Use TypeScript/TSX and import via `@/*` aliases (mapped to `src/*`).
- Follow existing style: 2-space indentation, semicolons, and single quotes.
- Use kebab-case filenames (example: `price-history-chart.tsx`).
- Export React components in PascalCase; keep utility functions in `src/lib/<domain>`.
- Keep reusable primitives in `src/components/ui`; avoid duplicating shared UI patterns.

## Testing Guidelines
- Framework: Jest with Testing Library (`jest-environment-jsdom`).
- Test file names: `*.test.ts`, `*.test.tsx` (or `*.spec.ts(x)`).
- Coverage gate: 70% global minimum for statements, branches, functions, and lines.
- Before opening a PR, run `npm test` and `npm run test:coverage`.

## Commit & Pull Request Guidelines
- Recent history includes both useful `feat:`/`fix:` commits and placeholder messages (`.`/`..`); use explicit messages for all new work.
- Preferred commit format: `type: short imperative summary` (example: `fix: handle empty product image list`).
- PRs should include: what changed, why, test evidence, related issue/task, and screenshots for UI changes.

## Security & Configuration Tips
- Do not commit secrets; copy from `.env.example` into local env files.
- Verify required services before local testing: Supabase/Postgres access and Python 3.8+ for scraping scripts.
