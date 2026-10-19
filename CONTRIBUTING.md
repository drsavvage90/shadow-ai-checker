# Contributing

Shadow AI Checker is a small toolkit for owners and IT providers. Changes should stay understandable to a managing partner who will read the quiz, and to an IT provider who will run the DNS check.

## Setup

Node.js 22 or newer and pnpm 10.

```bash
pnpm install
pnpm test
pnpm build
```

## Where things live

| Path | What it is |
| --- | --- |
| `packages/core` | Question bank, scoring, AI-service catalog, sensitive-data patterns. No React, no Chrome APIs, no filesystem. This is the package that can move into Vault's monorepo as `packages/shadow-ai`. |
| `apps/quiz` | Static Next.js assessment. |
| `apps/extension` | Manifest V3 extension. |
| `apps/dns-check` | DNS log CLI. |

`packages/core` is the source of truth for domains, patterns, and questions. The extension build copies domain match patterns from that catalog. Do not hand-edit the generated `apps/extension/dist` manifest.

## Add an AI service

Edit `packages/core/src/data/services.json`.

- Use a product hostname, not a company's whole apex, when the apex is shared (`google.com`, `microsoft.com`, `github.com`, and `openai.com` are rejected).
- Every service is included in the DNS catalog (`channels` includes `dns`).
- Set `channels` to include `extension` only when a paste warning on that site is useful. Weak signals such as Notion stay DNS-only.
- Add a `note` when a hit is easy to misread.
- The catalog test fails if a domain is duplicated or too broad.

## Add a sensitive-data pattern

Edit `packages/core/src/patterns.ts`. Patterns return a count and a label. They must not be wired to store or return the matched text from the extension. Add a unit test with a true example and a near miss. Prefer missing a fuzzy case over a warning on ordinary sentences.

## Add or edit a question

Edit `packages/core/src/data/questions.json`.

- Scored choices use an integer `risk` from 0 to 4. Every scored question needs a 0 and a choice of at least 3.
- Profile and inventory questions are not scored and must not set `risk`.
- A `fix` is a concrete next step for a small firm. Reuse a fix `id` when two choices on the same question are the same action at different urgency.
- Category weights must sum to 1.
- Keep the bank near 20 questions so the quiz stays about 10 minutes.

## Wording

Say "helps reduce risk." You may say "HIPAA-aligned" for a practice that already handles health information. Do not promise a legal outcome or that a duty was met. `pnpm check:wording` catches a few overclaims. Read the sentence anyway.

Be plain that unmanaged and personal devices are out of scope.

## Tests and CI

`pnpm test` runs unit tests. `pnpm typecheck`, `pnpm lint`, and `pnpm build` match GitHub Actions. Core behavior needs a test. A new log format needs a fixture in `apps/dns-check/examples` or the test file.

## Pull requests

Open a pull request against `main` with what changed and how you checked it. If you change the extension's behavior, update `apps/extension/EMPLOYEE_NOTICE.md` in the same change so the notice stays accurate.
