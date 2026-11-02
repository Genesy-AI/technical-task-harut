# Improvements & technical roadmap

Snapshot of `main` at `51d1d20`, after #7 (country-code validation), #8 (bounded email-verification retries) and #9 (phone, years at company, LinkedIn fields + field picker). Scope: issues outside those tasks, plus the follow-ups they surfaced. PR #1 (gender guessing) is reviewed separately; enrich phone is deferred (see Roadmap).

Priority: **P0** wrong data or broken flow · **P1** maintainability, next up · **P2** scale and polish.

## 1. Bugs

### Backend

| P   | Where                          | Problem                                                                                                                 | Fix                                                         |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| ✅  | `utils/messageGenerator.ts`    | `$` in a lead value corrupted the message (`Cash$$ & Co $&` → `Cash$ & Co {companyName}`)                               | Fixed in #9 (replacer function)                             |
| P0  | `utils/messageGenerator.ts:27` | `{toString}` / `{constructor}` pass the unknown-field check → message `Hi [object Undefined]`                           | `Object.hasOwn(availableFields, fieldName)`                 |
| P0  | `index.ts:12`                  | `express.json()` 100 kB default → CSVs over ~1k rows fail with 413, UI shows a generic error                            | Explicit limit matching the UI upload limit                 |
| P0  | `index.ts:205-220`             | Bulk import dedupes only against the DB and only by name → duplicates inside one file and same-email leads are inserted | Dedupe the batch on normalized email; unique index on email |
| P0  | `index.ts:60-73`               | PATCH writes the string `"undefined"` for omitted fields; client sends PUT; CORS doesn't allow PATCH                    | One partial-update contract, or remove (unused)             |
| P1  | `index.ts:27-42`               | `POST /leads` reads `name`, client sends `firstName` → always 400                                                       | Align or remove (unused)                                    |
| P1  | `index.ts:44-83`               | Unknown / `NaN` id → 500 or 200 with `null`                                                                             | 400 / 404                                                   |
| P1  | `index.ts:279`                 | New Temporal connection per request, not closed when a request fails                                                    | One shared client created at startup                        |
| P1  | `index.ts:327`                 | Worker failure calls `process.exit(1)` and takes the API down                                                           | Separate processes (see Scaling)                            |
| P1  | `prisma/dev.db`                | Country codes stored before #7 are never re-validated (seed has `UK`), so old and new rows disagree                     | One-off backfill with `normalizeCountryCode`                |

### Frontend

| P   | Where                       | Problem                                                              | Fix                                       |
| --- | --------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| P0  | `CsvImportModal.tsx:20, 92` | Duplicates inside the file are shown as a warning but still imported | Backend dedupes (above); preview shows it |
| P1  | `CsvImportModal.tsx:46`     | `.CSV` (uppercase) rejected                                          | Case-insensitive check                    |
| P1  | `api/utils.ts:4`            | `MAX_UPLOAD_FILE_SIZE` declared, never enforced                      | Enforce before reading the file           |
| P1  | `CsvImportModal.tsx:110`    | "Successfully imported 0 leads!" when everything was skipped         | Summary toast from the response counts    |
| P1  | `LeadsList.tsx:93`          | Select-all checkbox shows checked on an empty list                   | Require `length > 0`                      |
| P1  | `LeadsList.tsx:9`           | Selection keeps ids of leads deleted or refetched                    | Derive selection from current data        |
| P1  | `api/modules/leads.ts:18`   | `update` uses PUT, backend has PATCH                                 | Align with the backend contract           |

## 2. Backend design

- **P1 — Business logic out of routes.** `index.ts` mixes HTTP, validation, rules, Prisma, CORS and worker startup (SRP). Move to a `leads/` module: `routes.ts` (parse, validate, map errors) → `service.ts` (use cases) → Prisma.
- **P1 — One validation layer.** Body checks are hand-written in 5 routes (DRY). Use zod schemas at the boundary; derive the TS types from them and share them with the frontend.
- **P1 — Testable services.** Services take Prisma and the Temporal client as parameters → unit tests for use cases, route tests with supertest against a test DB. Today: 2 test files, no route tests.
- **P1 — Remove what isn't used.** `POST /leads`, `PATCH /leads/:id`, `GET /leads/:id` have no UI caller and two are broken (YAGNI).
- **P1 — Small cleanups.** Standard `cors` package; graceful shutdown (Prisma disconnect, worker shutdown); `dev.db` out of git + seed script; stale `.env.sample` (MySQL); empty-named migration `20240725105048_`.
- **DDD: modules first, not tactical patterns.** For this slice the `leads/` module (routes → service) is enough; aggregates/repositories/domain events would be ceremony here. The platform direction (section 7) uses DDD's bounded contexts as domain modules.

## 3. Temporal

Temporal is for external, slow, failure-prone calls (verify email today). Everything else stays in the API:

| Keep in the API             | Why                                                |
| --------------------------- | -------------------------------------------------- |
| Template message generation | Pure and fast, no I/O besides the DB               |
| CSV import                  | DB-only; revisit only at tens of thousands of rows |
| CRUD                        | Synchronous by nature                              |

- **P1 — One enrichment pattern.** API starts one workflow per lead (`<type>-<leadId>`, idempotent), returns 202; lead stores a status per enrichment; UI reads it from the leads list. Every new enrichment reuses it instead of a request-bound flow.
- **P1 — Move verify email onto it.** #8 bounded retries and runs leads in parallel, but the HTTP request still waits for every workflow, nothing caps concurrency, and workflow ids include `Date.now()`, so a double click starts duplicates. Adopting the pattern above fixes all three.
- **P1 — Activities that stop when told.** Timed-out attempts keep running (no heartbeat, cancellation ignored) and hold worker slots. Real provider activities heartbeat and pass an `AbortSignal` to `fetch`.
- **P1 — Provider rate limits.** Map 429 to a retryable failure with `nextRetryDelay` from `Retry-After`; once limits are known, one task queue per provider with `maxTaskQueueActivitiesPerSecond`, so one provider can't throttle the others.
- **P2 — Say what actually failed.** A failed DB write after a successful check is reported to the user as "couldn't verify"; keep provider and persistence failures apart.

## 4. Frontend

- **P1 — Reusable components.** `<Modal>` (shell duplicated in 2 modals; add focus trap + `role="dialog"`), `<Button variant>` (classes copy-pasted), `<Menu>` (outside click, Escape, keyboard), icons from the already installed `@tabler/icons-react` instead of 14 inline SVGs.
- **P1 — Split `LeadsList.tsx` (334 lines).** `LeadsToolbar`, `EnrichMenu`, `LeadsTable`, `useLeadSelection`; data access in a `useLeads` hook. Feature folder `features/leads/{components,hooks,api}`.
- **P1 — Backend is the single source of rules.** Since #7/#9 the backend validates optional fields and reports cleared values after import, but the preview can't flag them up front and email/required checks still live in the frontend. Add `POST /leads/bulk?dryRun=true` returning per-row errors; the modal renders that and drops its own rules.
- **P1 — Drive the table and CSV mapping from `/leads/fields`.** #9 made the backend field list the source for templates; the table columns, CSV header aliases and API types are still hand-listed, so a new field still touches ~7 places.
- **P2 — Table width.** With 3 more columns the table scrolls sideways and the name scrolls out of view: sticky name column, then a column-visibility toggle.
- **P1 — Delete `api/mutations/useApiMutation.ts`.** Type-level registry for one unused mutation; drops `lodash` and `ts-toolbelt`.
- **P1 — Green build and lint.** `tsc -b` fails (`useApiMutation.ts`), ESLint 9 with a legacy `.eslintrc.cjs`; stale `tailwind.config.js` under Tailwind 4.
- **P2 — UX.** Confirm before bulk delete; pending/disabled state on every action; component tests for the import and message modals.

## 5. Scaling & caching

| Challenge                                     | Fix                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `GET /leads` returns everything, no indexes   | Pagination, server-side filter/sort, indexes on `email`, `createdAt` |
| Long requests (bulk import, generate, verify) | Async jobs with status; batched inserts in one transaction           |
| API and worker in one process                 | Separate processes, scale and fail independently                     |

Caching — only where it pays:

- **Enrichment results by input key** (e.g. email → verified) in a DB table with TTL, so a provider is never paid twice for the same lookup.
- **Leads list:** no server cache. Pagination + indexes first; TanStack Query `staleTime` on the client, invalidation on mutations as today.

## 6. Roadmap

1. **Stabilize (days):** all bugs above, green frontend build and lint, CI (typecheck, test, lint, build for both packages; cache the Temporal test-server download that #8's workflow test needs), `dev.db` out of git.
2. **Structure (1–2 weeks):** `leads/` module + zod + shared types, enrichment job pattern + shared Temporal client (verify email moves onto it), reusable UI components, `LeadsList` split, `dryRun` import validation, table/CSV driven by `/leads/fields`, delete `useApiMutation`.
3. **Enrich phone (deferred):** first feature built on the job pattern — three providers in sequence behind small adapters, rate limits handled from day one. Open product decisions: derive Orion's `companyWebsite` from the email domain or add the field; skip leads that already have a phone; store Nimbus numbers as returned (it returns `phoneNmbr` as a number, not `number` as documented) and normalize to E.164 only when dialing needs it.
4. **Scale:** pagination + indexes, API/worker split, enrichment cache.
5. **Platform:** domain modules, AI steps as workflows, read model when lists slow down (see below).

## 7. Direction for the larger platform

This repo is one slice of a product with many workflows (enrichment, AI messaging, campaigns). Direction:

- **Modular monolith with domain modules** (`leads`, `enrichment`, `messaging`, …). Each module owns its data and API; others call its service, never its tables. This is the part of DDD that pays off (bounded contexts); tactical patterns only inside modules with real business rules.
- **Temporal as the backbone for every long or external step.** One job pattern: idempotent ID, status on the lead, timeouts and retries, a task queue per provider. Workers scale apart from the API, which gives the scaling benefit of services without splitting the codebase. Extract a service only when a module needs its own deploy cycle.
- **AI as a workflow step, not a request.** LLM calls run as activities with timeout, retry and a cost budget. Prompts are versioned; output is validated against a schema before it's saved; each result stores model + prompt version. Generated messages land in a review state before anything is sent.
- **Read model when lists grow (CQRS-lite).** One lead view for the table that joins enrichment statuses, added only when queries get slow.
- **One contract source.** Schemas (zod/OpenAPI) generate the client types; REST stays.
