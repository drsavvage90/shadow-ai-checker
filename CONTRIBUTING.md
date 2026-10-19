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
- Category weights in the question bank must sum to 1. The score uses the profession weights in `jurisdictions.json` instead, and those profiles must also sum to 1.
- `appliesTo.professions` limits a question to a profession. Law-firm citation questions and the CPA review question use it. Omit it when every profession should see the question.
- Keep the bank near 20 questions so the check stays about 10 minutes.

## Add a state or a cited rule

Edit `packages/core/src/data/jurisdictions.json`.

- Add the state id to `states`, to the state question in `questions.json`, and to `STATE_IDS` in `packages/core/src/brand.ts`.
- State-specific expectations list that state id. Federal or model rules use `"states": ["*"]` so a new state inherits them on purpose.
- Every expectation needs a summary, a citation, and an `https` URL you have actually read. If you cannot verify a requirement, omit it or say the checklist does not encode it.
- `relatedQuestions` turns an expectation into a gap when an answer scores 2 or higher. Leave the list empty for background statements, including Kentucky's "no general disclosure duty" answer and Ohio's nonbinding guide.
- Put a profession's category weights in `weightProfiles`. Every profession is in exactly one profile, and a profile must weight every category that profession is asked about.

## Wording

Say "helps reduce risk." You may say "HIPAA-aligned" for a practice that already handles health information. Do not promise a legal outcome, a sanction avoided, or that a duty was met. Say "not legal advice." `pnpm check:wording` catches a few overclaims. Read the sentence anyway.

Be plain that unmanaged and personal devices are out of scope.

## Tests and CI

`pnpm test` runs unit tests. `pnpm typecheck`, `pnpm lint`, and `pnpm build` match GitHub Actions. Core behavior needs a test. A new log format needs a fixture in `apps/dns-check/examples` or the test file.

## Pull requests

Open a pull request against `main` with what changed and how you checked it. If you change the extension's behavior, update `apps/extension/EMPLOYEE_NOTICE.md` in the same change so the notice stays accurate.
