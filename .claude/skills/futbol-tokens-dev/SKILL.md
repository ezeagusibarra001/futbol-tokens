---
name: futbol-tokens-dev
description: Use this skill when developing any feature, bug fix, or refactor inside this repo (Node.js + TypeScript + Express + Mongoose backend for the "Valoración de mercado de Jugadores de fútbol" TP). It captures the project's layered architecture, file/folder conventions, testing rules (Jest + ts-jest), and the workflow expected before declaring a task done. Trigger when the user asks to "add an endpoint", "create a module", "implement X feature", "fix a bug", or anything that touches src/modules/**.
---

# futbol-tokens — Development guide

This is a backend (Node.js + TypeScript + Express + Mongoose) that exposes a REST API to model a football-player token market. Follow this skill any time you write code in this repo.

## 0. HANDOFF.md — read first, update after

[HANDOFF.md](HANDOFF.md) at the repo root is the source of truth for "what's done / what's next" across sessions.

- **At the start of every session or task**: open `HANDOFF.md` before doing anything else. Use it to know which step of the 10-step plan is next, which decisions are already locked in (don't re-debate them with the user), and any known blockers.
- **After completing any task** (a step, a sub-step, or a meaningful fix): update `HANDOFF.md` in the same turn — flip the checkbox to `[x]`, add a one-line summary of what was done under that step, bump the "Última actualización" block (date + one-line summary), and add any new decision to the "Decisiones tomadas" list.
- **When in progress**: mark `[~]` and note what's blocking or what's left.
- **If you discover a new task or a scope change**: add it as a new bullet under the relevant step or as a new step at the bottom, so future sessions see it.
- If `HANDOFF.md` and the user's request disagree, ask before proceeding — don't silently follow either.

## 1. Stack & runtime

- **Language**: TypeScript (strict mode), target ES2020, CommonJS module output.
- **Runtime**: Node.js + Express 4.
- **DB**: MongoDB via Mongoose. Connection in [src/config/db.ts](src/config/db.ts), env var `MONGO_URI`. Operations that touch multiple documents atomically must use sessions/transactions (replica set required locally).
- **Auth**: JWT (access + refresh) via `jsonwebtoken`, password hashing with `bcryptjs`. Middleware in [src/modules/auth/auth.middleware.ts](src/modules/auth/auth.middleware.ts).
- **Docs**: Swagger via JSDoc annotations on route files — rendered at `/api-docs` ([src/docs/swagger.ts](src/docs/swagger.ts)).
- **Scraping**: `puppeteer-extra` with stealth plugin for WhoScored.
- **External APIs**: `axios`. Football-Data.org is the catalog source.
- **Tests**: Jest + ts-jest. Lint: ESLint flat config (`eslint.config.js`).

## 2. Project structure

```
src/
  app.ts                  # Express app: middlewares, routes mount, error handler
  index.ts                # Bootstrap: connectDB() then app.listen()
  config/
    db.ts                 # mongoose.connect(MONGO_URI)
  docs/
    swagger.ts            # swagger-jsdoc setup
  modules/
    <feature>/
      <feature>.model.ts        # Mongoose Schema + IModel interface (+ IDoc extending Document)
      <feature>.repository.ts   # All DB queries (find/findById/upsert/bulkWrite). NO business logic here.
      <feature>.service.ts      # Business logic. Orchestrates repository + adapters. Throws errors with .status.
      <feature>.controller.ts   # Express handlers: parse req, call service, shape response, call next(err) on throw.
      <feature>.routes.ts       # Router with Swagger JSDoc above each endpoint. Mount auth middleware here.
      dto/                      # Plain types/DTOs for IO (scraping, external APIs, request payloads).
      __tests__/                # Co-located unit tests, one file per layer being tested.
```

Mount new routers in [src/app.ts](src/app.ts) under a base path: `app.use('/<feature>', <feature>Routes)`.

## 3. Layering rules (do not break)

- **Controller** never imports the repository or model directly — it only calls the service.
- **Service** is the only place with business rules. It composes repository calls + external adapters. Throws domain errors as `Object.assign(new Error('msg'), { status: 4xx })` so the global error handler in [src/app.ts](src/app.ts) maps them.
- **Repository** owns *all* Mongoose calls. Returns lean documents (`.lean<IDoc>().exec()`) for read paths. No `throw` here except for invalid input that the layer above couldn't have prevented.
- **Model** exports the Schema, the `IXxx` plain interface, and `IXxxDoc extends IXxx, Document`. Add indices in the schema, not at runtime.
- **DTOs** in `dto/` are for shapes that cross the wire (external API payloads, scraper output, request bodies if non-trivial). Don't reuse `IModel` interfaces as request DTOs.
- **Adapters** for external APIs live under `src/modules/integrations/<provider>/`. They expose typed functions and must tolerate failure (catch + log + return empty/fallback) so the system keeps working from local data (non-functional requirement 7 of the TP).

## 4. Conventions

- Strict TS — no `any`. Use `unknown` and narrow.
- `req.params['id']` is typed as `string | undefined` in this repo; always guard.
- Mongoose unique constraints go through compound indices in the schema (see [player.model.ts](src/modules/player/player.model.ts)).
- For mutations across more than one document or collection, wrap in `mongoose.startSession()` + `session.withTransaction()`. Always pass `{ session }` to every query inside.
- Idempotency: order/payment-like endpoints accept an `Idempotency-Key` header; persist it and return the prior result on retry.
- Errors with status: `throw Object.assign(new Error('Not found'), { status: 404 });`. The global handler maps it.
- Logs: prefer `console.info` / `console.warn` / `console.error` for now — there is no logger abstraction yet. If you introduce one, do it in a single place (`src/config/logger.ts`) and use it everywhere.
- Filenames are lowercase with dots: `feature.layer.ts`. Tests mirror under `__tests__/feature.layer.test.ts`.
- Swagger JSDoc lives **on the routes file**, above the router definition. Reuse `#/components/schemas/...` for models.

## 5. Testing (Jest + ts-jest)

Tests live under `src/modules/<feature>/__tests__/` and match `**/__tests__/**/*.test.ts` ([jest.config.ts](jest.config.ts)).

### Required tests per layer

When you add or modify code, add/update unit tests as follows:

- **Model**: validation tests using `new Model({...})` and `doc.validate()` — verify defaults and required-field failures. No DB connection required.
- **Repository**: skip pure delegations. Test only non-trivial query construction (e.g. dynamic filters, regex). Mock `Model.find/findById/...` via `jest.spyOn`.
- **Service**: the heart of the suite. Mock `../<feature>.repository` and any adapter with `jest.mock(...)`. Test happy paths, edge cases, and thrown errors (use `expect(...).rejects.toThrow()` or assert `.status`).
- **Controller**: light — assert it calls the service with the right args and shapes the response/status. Mock the service. Use Express mocks for `req`/`res`/`next` (small inline objects with `jest.fn()` are fine; no supertest unless integration is needed).
- **Middleware**: focused tests with mocked `req`/`res`/`next`, asserting `next()` was called (or not) and status codes on rejection.

### Patterns

```ts
// Mocking a sibling module
jest.mock('../player.repository');
import * as repo from '../player.repository';
(repo.findPlayers as jest.Mock).mockResolvedValue([...]);

// Resetting between tests
beforeEach(() => jest.clearAllMocks());

// Service-level error assertion
await expect(buy(...)).rejects.toMatchObject({ message: 'No stock', status: 409 });
```

### Bar for "done"

A change is not done until:

1. `npx tsc --noEmit` is clean (strict TS).
2. `npx jest` is fully green (every suite, not just the one you touched).
3. New behavior has at least one test covering it (happy + one failure path for service-level code).
4. Public endpoints have Swagger JSDoc above the route.
5. No `any`, no unused imports/vars, no console noise added to library code.
6. [HANDOFF.md](HANDOFF.md) updated to reflect the new state (checkbox flipped, summary line under the step, "Última actualización" bumped).

If you can't write a meaningful test (UI, scraper end-to-end, etc.), say so explicitly to the user instead of skipping silently.

## 6. Adding a new feature module — checklist

1. Create `src/modules/<feature>/` with files: `model.ts`, `repository.ts`, `service.ts`, `controller.ts`, `routes.ts`, `dto/` (if needed).
2. Write the Mongoose schema first; export `IXxx`, `IXxxDoc`, and the `model<IXxxDoc>('Xxx', schema)`.
3. Write repository functions (return lean for reads). Keep names verb-led: `findX`, `findXById`, `upsertX`, `bulkUpsertX`.
4. Write service with business rules. If it touches > 1 document, plan a transaction now.
5. Write controller — thin, only request parsing and response shaping.
6. Write routes file with Swagger JSDoc per endpoint. Mount in [src/app.ts](src/app.ts).
7. Add tests for model (validation), service (happy + error), controller (delegation + status mapping).
8. Run `npx tsc --noEmit && npx jest` before declaring done.

## 7. Adding an external API adapter

Location: `src/modules/integrations/<provider>/<provider>.client.ts`.

- Read API base URL and token from `process.env` — fail fast with a clear message if missing only when the function is *actually invoked*, not at import time (so tests don't need the env).
- Export typed functions that return plain DTOs from `dto/`.
- Wrap network calls in try/catch; on failure, log and return an empty/fallback shape, never throw past the boundary (TP requires the system to keep working with local data).
- Add a test that mocks `axios` and asserts the URL/headers and the fallback path on error.

## 8. Running things

- `npm run dev` — ts-node, hot path is `src/index.ts`.
- `npm test` — Jest, all suites.
- `npx tsc --noEmit` — typecheck without emitting.
- `npm run lint` — ESLint.
- `npm run scrape` — runs the WhoScored scraper test entry (`tsx src/modules/player/scrapper.test.ts`). Only for ad-hoc verification.

## 9. What NOT to do

- Don't put DB calls in controllers or services-via-side-effects. Always go through the repository.
- Don't use the model's class as a request DTO; use a `dto/` type.
- Don't add a new top-level dependency without checking [package.json](package.json) first.
- Don't introduce a logger, validator, or DI container as a side task — propose it explicitly to the user.
- Don't mark a task complete with failing tests or TS errors, even if the failures are "pre-existing". Flag them to the user.
