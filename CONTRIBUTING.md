# Contributing to Open AdScan

Thanks for considering a contribution.

## Dev loop

```bash
pnpm install
wrangler d1 migrations apply DB --local
pnpm seed && wrangler d1 execute DB --local --file=seed/demo.sql
pnpm dev
```

## Before opening a PR

```bash
pnpm test
pnpm test:coverage
pnpm typecheck
pnpm lint
```

CI runs the same four commands.

## Code style

- TypeScript strict, `noUncheckedIndexedAccess` on
- Pure logic goes in `src/features/*/analyzer.ts` or `src/features/*/evaluator.ts` — IO-free, unit-tested
- IO wrappers go in `src/features/*/recommender.ts` / `src/features/*/snapshot.ts` etc., and call the pure logic
- No comments unless they explain *why* — prefer a clear name and a unit test

## Adding a connector

1. New folder under `src/connectors/<name>/`
2. Implement `client.ts`, `oauth.ts` (or auth equivalent), `ingest.ts`, `types.ts`
3. Wire `connections.type` enum in `src/lib/db/schema.ts` and the migration
4. Add a queue handler discriminant in `src/env.ts` (`IngestMessage`) and a case in `src/jobs/consumer.ts`
5. Add a cron trigger in `wrangler.toml` and a case in `src/jobs/scheduler.ts`
6. Add a connector card on `src/routes/settings/connections.tsx`
7. Add tests under `tests/connectors/<name>.test.ts` with mocked `fetch`

## Adding a feature module

1. New folder under `src/features/<name>/`
2. Put pure logic in `analyzer.ts` or `evaluator.ts`
3. Add unit tests in `tests/features/<name>.test.ts`
4. Add the wrapper that reads/writes D1 in a separate file
5. Add a route under `src/routes/<name>/`
6. Add a sidebar entry in `src/ui/Nav.tsx`
