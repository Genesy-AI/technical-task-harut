# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Goal and scope

TinyEnginy take-home (time-boxed 1–2h, screen-recorded). The point is to demonstrate an effective, well-reasoned AI-assisted workflow — product mindset, trade-offs, and clear explanations matter as much as the code. Treat the codebase as production code. Full task text is in `README.md`; the tasks are independent:

1. **Bug — CSV country codes:** importing `docs/leads-*.csv` shows garbled characters instead of country codes.
2. **Bug — email verification hangs:** some leads never get a success/failure result.
3. **Feature — new lead fields:** phone number, years at current company, LinkedIn URL — visible in the leads table, settable via CSV import, usable in message templates. The message-composition UX must scale as fields keep growing.
4. **Feature — enrich phone (Temporal):** workflow calling three providers in sequence (Orion Connect → Astra Dialer → Nimbus Lookup), stop at first hit, otherwise "No data found". Each provider call is an activity with a short timeout and retry policy (e.g. 3 attempts, exponential backoff); one workflow per lead (idempotent); an abstraction layer over the differing provider inputs/outputs/auth; user-visible progress. Provider URLs, payloads and auth are in `README.md`. Nice to have: prepare for provider rate limits.
5. **PR review:** review open PR #1 "Feature/implement gender guessing" (`gh pr view 1`). Inline comments + summary with approve/request-changes. **Posting to GitHub requires explicit user approval.**
6. **Analysis:** write `IMPROVEMENTS.md` (codebase improvements + technical roadmap) as a project-management doc.

Don't fix unrelated issues while on a task — note them for `IMPROVEMENTS.md` instead.

## Working agreement

- **One session = one task = one branch = one worktree.** The user runs a separate Claude Code session per terminal tab and steers each one. Stay inside your task; never touch other sessions' worktrees, branches, ports or processes.
- **The user reviews before anything is recorded.** Never commit, amend, merge, rebase, push, open/merge PRs, or post GitHub comments without the user's explicit approval _for that step, after they have seen the diff_. Approval of one step never carries over to the next.
- **Nothing goes to `main` directly** — including docs and this file: branch → commit (after approval) → PR → user review → merge.
- Branches: `fix/<topic>`, `feat/<topic>`, `docs/<topic>`, `chore/<topic>`.
- Commits: always Conventional Commits (`<type>: <subject>`, e.g. `fix: stop endless email verification retries`) unless the user says otherwise. Subject is short, lowercase, imperative and states the purpose — no fluff, no filler words. Add a body only when the _why_ isn't obvious. One logical change per commit.
- Ask before anything destructive or shared: deleting branches/worktrees, resets, terminating Temporal workflows, stopping processes, changing data in the user's running app.
- Don't delegate to subagents unless the user asks — the user parallelises by opening sessions themselves.

## Engineering standard

Work as a principal engineer, not a code generator. The first change that makes the symptom disappear is rarely the right fix.

1. **Understand first.** Reproduce the bug or pin down the requirement, and find the root cause with evidence (file:line, logs, Temporal history). Read the surrounding code and existing patterns before proposing anything.
2. **Think broader, choose the simplest clean solution.** Weigh 2–3 approaches — fix it where it originates; reuse an existing pattern or helper; what production needs (failure modes, retries, idempotency, contracts). For anything non-trivial, present the approach, trade-offs and files to touch, and wait for the user's go-ahead before editing.
3. **Clean code, no duplication.**
   - One source of truth per piece of knowledge within a package; reuse existing helpers and types. Cross-package sharing (there is no shared package) is a design decision — raise it, don't improvise infrastructure.
   - Follow the conventions of the code you touch; small focused functions; intention-revealing names; precise types (no `any`, no needless casts); comments explain _why_, not _what_.
   - Minimal diff: no drive-by refactors, speculative abstractions, or new dependencies without a stated reason.
4. **Production mindset.** Validate untrusted input on the backend (frontend checks are UX only); keep API/data contracts backward compatible or call out the break; bound every external call with a timeout; keep loading, empty and error states visible to the user.
5. **Tests prove behaviour.** Bug: failing regression test first, then the fix. Feature: tests for the contract and edge cases. Never weaken an existing test.

## Task flow (every session)

1. Understand and reproduce.
2. Propose the approach and trade-offs; wait for approval if non-trivial.
3. Implement with tests.
4. Verify — all of these that apply, reporting the exact commands and results (and what was _not_ run):
   - `pnpm test --run` and the typecheck in each touched package; `pnpm exec prettier --check <changed files>`.
   - UI changes: drive the real app with Playwright in your own slot (below) and screenshot the key states, including error/loading states.
   - Temporal changes: confirm outcomes with `temporal workflow list|describe|show --namespace <your namespace>`.
5. Self-review: run `/code-review` on the diff, then `/simplify`. Present the findings; apply the ones the user agrees with; re-verify.
6. Hand over: root cause or design decision, trade-offs, evidence, open risks, items for `IMPROVEMENTS.md`, and the diff summary.
7. Commit only after the user approves.

## Environment and commands

Node 22 (`.nvmrc` in `backend/` and `frontend/`; run `nvm use` in each new shell — if `nvm` isn't available in the shell, put `~/.nvm/versions/node/v22.*/bin` first on `PATH`), pnpm, Temporal CLI. Each package is installed and run separately — there is no root workspace.

```zsh
temporal server start-dev            # Temporal on :7233, Web UI on http://localhost:8233 (in-memory)

# backend/  (Express API on :4000 + Temporal worker, same process)
pnpm run dev                         # nodemon + ts-node src/index.ts
pnpm exec tsc --noEmit               # typecheck
pnpm test --run                      # vitest, single run (plain `pnpm test` = watch mode)
pnpm test --run src/utils/messageGenerator.test.ts -t "<test name>"   # single file / test
pnpm migrate:dev                     # after editing prisma/schema.prisma (creates a migration)
pnpm gen:prisma                      # regenerate Prisma client

# frontend/  (Vite + React 18 + TanStack Query + Tailwind 4)
pnpm run dev
pnpm exec tsc -b                     # typecheck (also first step of `pnpm build`)
pnpm test --run                      # vitest + jsdom
pnpm lint
```

Prettier (both packages): no semicolons, single quotes, `printWidth` 110, `trailingComma: es5`.

**Baseline state (pre-existing — don't fix unless it's your task, but add no new failures):** backend typecheck and tests pass; frontend tests pass, but frontend `tsc -b` fails (`useApiMutation.ts` optimistic lead lacks `emailVerified`, so `pnpm build` fails) and `pnpm lint` fails (ESLint 9 with legacy `.eslintrc.cjs`). pnpm reports `ERR_PNPM_IGNORED_BUILDS` on install; everything works regardless — don't run `pnpm approve-builds` (it edits package files) without asking.

## Isolated environments for parallel sessions

**Worktree per session**

```zsh
git worktree add .claude/worktrees/<topic> -b <type>/<topic> main
cd .claude/worktrees/<topic>/backend && nvm use && pnpm install && pnpm gen:prisma
cd ../frontend && nvm use && pnpm install
```

- A worktree contains only **committed** files. Get this file and any shared setup merged into `main` before creating worktrees, and branch from an up-to-date `main`.
- Each worktree has its own copy of `backend/prisma/dev.db` — private test data. Don't commit incidental `dev.db` changes (`git checkout backend/prisma/dev.db`); commit it only together with an intentional migration.
- `.claude/worktrees/` and `.playwright-mcp/` must be in `.gitignore`.

**Runtime slot per session** — use only your slot; before starting a server, check the port is free (`lsof -iTCP:<port> -sTCP:LISTEN`); never stop a process you didn't start.

| Slot        | Backend `PORT` | Frontend (`--port`) | `VITE_API_URL`          | `TEMPORAL_NAMESPACE` |
| ----------- | -------------- | ------------------- | ----------------------- | -------------------- |
| main (user) | 4000           | 5173                | `http://localhost:4000` | `default`            |
| 1           | 4001           | 5174                | `http://localhost:4001` | `wt-1`               |
| 2           | 4002           | 5175                | `http://localhost:4002` | `wt-2`               |
| 3           | 4003           | 5176                | `http://localhost:4003` | `wt-3`               |

```zsh
temporal server start-dev -n wt-1 -n wt-2 -n wt-3        # one shared server; namespaces pre-created
temporal operator namespace create --namespace wt-1      # or add one to an already-running server
PORT=4001 TEMPORAL_NAMESPACE=wt-1 pnpm run dev           # backend/ in the worktree
VITE_API_URL=http://localhost:4001 pnpm run dev --port 5174 --strictPort   # frontend/ in the worktree
```

- The backend reads `PORT` (default `4000`) and `TEMPORAL_NAMESPACE` (default `default`) via `backend/src/config.ts`; unset means today's single-instance setup. The namespace must exist before the backend starts: otherwise the API comes up briefly, then the worker fails with `Namespace … is not found` and the process exits (nodemon shows "app crashed").
- **Why a namespace per slot:** it isolates task queues _and_ workflow IDs. Workers on the same queue steal each other's tasks, and lead IDs (hence ID-based workflow IDs) repeat across worktree databases.
- **Playwright (MCP):** must run with `--isolated` (own in-memory browser profile per session; otherwise a second session fails with `Browser is already in use`). One-time setup: `claude mcp add playwright -s local -- npx @playwright/mcp@latest --isolated`. Drive only your slot's frontend URL. Artifacts are written to `.playwright-mcp/` in the repo root; uploaded files must be inside the repo (e.g. `docs/*.csv`). Data-changing actions (import, delete, verify) are fine in your own slot; in the user's main slot, ask first.

**File overlap between tasks:** tasks 3 (new fields) and 4 (enrich phone) both change the schema, migrations, `index.ts` and `LeadsList.tsx`, and task 4 needs the phone field — do 4 on top of a merged 3. Two branches adding Prisma migrations at once will conflict. Low-overlap with each other: task 1 (CSV import path), task 2 (Temporal verify-email path), task 5 (read-only review), task 6 (`IMPROVEMENTS.md`).

## Architecture

**Backend** (`backend/src`)

- `index.ts` — the entire Express API (all `/leads` routes, hand-rolled CORS) **and** it starts the Temporal worker via `runTemporalWorker()`. Prisma client is created here.
- `config.ts` — runtime settings (port, Temporal address/namespace/task queue); the single place for them.
- `worker.ts` — Temporal worker on the configured namespace and task queue (`myQueue`); workflows loaded from `./workflows`, activities from `./workflows/activities`.
- `workflows/workflows.ts` — workflow definitions (runs in Temporal's deterministic sandbox: no I/O there, only via activities). `workflows/activities/` — activity implementations (currently the stubbed `verifyEmail`, which simulates an external service).
- `POST /leads/verify-emails` connects a Temporal client per request and `await`s `client.workflow.execute(...)` for each lead sequentially, inside the HTTP request.
- `utils/messageGenerator.ts` — `{fieldName}` template substitution; throws on unknown or empty fields.
- Prisma + SQLite: `prisma/schema.prisma` (single `lead` model); DB URL is hardcoded to `file:./dev.db` (`.env.sample` mentions MySQL and is stale — no backend `.env` is needed). `prisma/dev.db` is **tracked in git**.

**Frontend** (`frontend/src`)

- API layer: `api/modules/leads.ts` declares endpoints via the typed `endpoint<Output, Input>()` helper (`api/utils.ts`); request/response types live in `api/types/leads/*.ts` and are hand-maintained to mirror the backend. Base URL from `VITE_API_URL` (`frontend/.env`, tracked).
- Server state via TanStack Query; the leads list uses query key `['leads', 'getMany']`, and mutations invalidate it. `api/mutations/useApiMutation.ts` is a typed mutation registry (currently only `leads.create`); components mostly call `useMutation` directly.
- UI: `components/LeadsList.tsx` (table, selection, delete, Enrich menu: Generate Messages / Verify Email / Guess Gender stub), `CsvImportModal.tsx` (client-side parse via `utils/csvParser.ts` → `POST /leads/bulk`; the preview shows name, email and company only), `MessageTemplateModal.tsx` (template editor with a hard-coded row of field buttons → `POST /leads/generate-messages`).

**Lead fields are duplicated across both packages** — adding or changing a field touches: `prisma/schema.prisma` (+ migration), `backend/src/index.ts` (bulk create), `backend/src/utils/messageGenerator.ts` (`Lead` + `availableFields`), `frontend/src/api/types/leads/{getMany,bulkImport}.ts`, `frontend/src/utils/csvParser.ts`, `CsvImportModal.tsx`, `LeadsList.tsx`, `MessageTemplateModal.tsx` (hard-coded `availableFields`), `api/mutations/useApiMutation.ts`.

Sample data: `docs/leads-*.csv` (headers include `yearsInRole` and `phoneNumber`; no LinkedIn column). Wireframes: `docs/ui-wireframes.png`.
